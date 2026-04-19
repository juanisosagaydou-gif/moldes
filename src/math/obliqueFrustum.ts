import type { ObliqueFrustumInput, PatternPiece, PatternResult, Point, TextAnnotation } from '../types/geometry';

const GAP = 20; // mm gap between main pattern and base circle

function circlePath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(3);
  return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
}

const N = 128;

function dist3(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
}

/**
 * Given anchors P1 (distance d1) and P2 (distance d2), find the third vertex.
 * Selects the candidate on the SAME side of P1→P2 as refPoint when sameSide=true,
 * or the OPPOSITE side when sameSide=false.
 *
 * This is the correct rule for triangle-strip unfolding: each new vertex is on
 * the opposite side of the shared edge from the previous vertex in the strip.
 */
function trilaterate2D(
  p1x: number, p1y: number, d1: number,
  p2x: number, p2y: number, d2: number,
  refX: number, refY: number,
  sameSide: boolean
): [number, number] {
  const ddx = p2x - p1x;
  const ddy = p2y - p1y;
  const d12 = Math.sqrt(ddx * ddx + ddy * ddy);
  if (d12 < 1e-12) return [p1x + d1, p1y];

  const cosA = Math.max(-1, Math.min(1, (d12 * d12 + d1 * d1 - d2 * d2) / (2 * d12 * d1)));
  const A = Math.acos(cosA);
  const angle12 = Math.atan2(ddy, ddx);

  const c1x = p1x + d1 * Math.cos(angle12 + A);
  const c1y = p1y + d1 * Math.sin(angle12 + A);
  const c2x = p1x + d1 * Math.cos(angle12 - A);
  const c2y = p1y + d1 * Math.sin(angle12 - A);

  // Cross product of edge P1→P2 with vector to each point — sign encodes side
  const crossRef = ddx * (refY - p1y) - ddy * (refX - p1x);
  const crossC1  = ddx * (c1y  - p1y) - ddy * (c1x  - p1x);

  const c1SameSide = (crossRef >= 0) === (crossC1 >= 0);
  if (sameSide ? c1SameSide : !c1SameSide) return [c1x, c1y];
  return [c2x, c2y];
}

export function computeObliqueFrustum(input: ObliqueFrustumInput): PatternResult {
  const { bottomRadius: R, topRadius: r, height: h } = input;

  const [bigR, smallR] = R >= r ? [R, r] : [r, R];
  const dx = bigR - smallR;
  const dTheta = (2 * Math.PI) / N;

  // 3D positions
  const b3x = new Float64Array(N + 1);
  const b3z = new Float64Array(N + 1);
  const t3x = new Float64Array(N + 1);
  const t3z = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const theta = i * dTheta;
    b3x[i] = bigR * Math.cos(theta);
    b3z[i] = bigR * Math.sin(theta);
    t3x[i] = dx + smallR * Math.cos(theta);
    t3z[i] = smallR * Math.sin(theta);
  }

  const e_b = dist3(b3x[0], 0, b3z[0], b3x[1], 0, b3z[1]);
  const e_t = dist3(t3x[0], h, t3z[0], t3x[1], h, t3z[1]);

  const e_l = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    e_l[i] = dist3(b3x[i], 0, b3z[i], t3x[i], h, t3z[i]);
  }

  const e_c = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    e_c[i] = dist3(b3x[i + 1], 0, b3z[i + 1], t3x[i], h, t3z[i]);
  }

  const bottom2D_x = new Float64Array(N + 2);
  const bottom2D_y = new Float64Array(N + 2);
  const top2D_x    = new Float64Array(N + 2);
  const top2D_y    = new Float64Array(N + 2);

  // Place first bottom edge on x-axis
  bottom2D_x[0] = 0;   bottom2D_y[0] = 0;
  bottom2D_x[1] = e_b; bottom2D_y[1] = 0;

  // T[0]: from B[0] and B[1] — want it ABOVE the x-axis edge.
  // Use a reference point below the edge (sameSide=false → opposite = above).
  [top2D_x[0], top2D_y[0]] = trilaterate2D(
    bottom2D_x[0], bottom2D_y[0], e_l[0],
    bottom2D_x[1], bottom2D_y[1], e_c[0],
    e_b * 0.5, -1,  // below midpoint of B[0]B[1]
    false            // opposite → above
  );

  // T[1]: from B[1] and T[0] — B[0] is on opposite side of B[1]→T[0] from T[1]
  [top2D_x[1], top2D_y[1]] = trilaterate2D(
    bottom2D_x[1], bottom2D_y[1], e_l[1],
    top2D_x[0], top2D_y[0], e_t,
    bottom2D_x[0], bottom2D_y[0],  // ref = B[0]
    false
  );

  for (let i = 1; i < N; i++) {
    // B[i+1]: from B[i] and T[i] — T[i-1] is on opposite side of B[i]→T[i]
    [bottom2D_x[i + 1], bottom2D_y[i + 1]] = trilaterate2D(
      bottom2D_x[i], bottom2D_y[i], e_b,
      top2D_x[i],    top2D_y[i],    e_c[i],
      top2D_x[i - 1], top2D_y[i - 1],  // ref = T[i-1]
      false
    );

    // T[i+1]: from B[i+1] and T[i] — B[i] is on opposite side of B[i+1]→T[i]
    [top2D_x[i + 1], top2D_y[i + 1]] = trilaterate2D(
      bottom2D_x[i + 1], bottom2D_y[i + 1], e_l[i + 1],
      top2D_x[i],        top2D_y[i],        e_t,
      bottom2D_x[i], bottom2D_y[i],  // ref = B[i]
      false
    );
  }

  // Build polygon: bottom L→R, then top R→L
  const allPoints: Point[] = [];
  for (let i = 0; i <= N; i++) allPoints.push({ x: bottom2D_x[i], y: bottom2D_y[i] });
  for (let i = N; i >= 0; i--) allPoints.push({ x: top2D_x[i], y: top2D_y[i] });

  const pathParts: string[] = [];
  pathParts.push(`M ${bottom2D_x[0].toFixed(3)} ${bottom2D_y[0].toFixed(3)}`);
  for (let i = 1; i <= N; i++) {
    pathParts.push(`L ${bottom2D_x[i].toFixed(3)} ${bottom2D_y[i].toFixed(3)}`);
  }
  for (let i = N; i >= 0; i--) {
    pathParts.push(`L ${top2D_x[i].toFixed(3)} ${top2D_y[i].toFixed(3)}`);
  }
  pathParts.push('Z');
  const svgPath = pathParts.join(' ');

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const maxSlant   = Math.sqrt(4 * (bigR - smallR) ** 2 + h * h);
  const bottomCirc = 2 * Math.PI * bigR;
  const topCirc    = 2 * Math.PI * smallR;

  const patternBoundaryPoints: Point[] = allPoints.filter((_, i) => i % 4 === 0);

  // Bottom base circle placed to the right of the unrolled pattern
  const bCx = boundingBox.x + boundingBox.width + GAP + bigR;
  const bCy = boundingBox.y + boundingBox.height / 2;
  const baseCirclePath = circlePath(bCx, bCy, bigR);

  const finalSvgPath = svgPath + ' ' + baseCirclePath;

  // Extended bounding box
  const extLeft   = boundingBox.x;
  const extTop    = Math.min(boundingBox.y, bCy - bigR);
  const extRight  = bCx + bigR;
  const extBottom = Math.max(boundingBox.y + boundingBox.height, bCy + bigR);
  const extBoundingBox = {
    x: extLeft,
    y: extTop,
    width: extRight - extLeft,
    height: extBottom - extTop,
  };

  // Boundary points: main pattern + base circle outline
  const N_CIRCLE = 32;
  const circlePoints: Point[] = [];
  for (let i = 0; i < N_CIRCLE; i++) {
    const theta = (i / N_CIRCLE) * 2 * Math.PI;
    circlePoints.push({ x: bCx + bigR * Math.cos(theta), y: bCy + bigR * Math.sin(theta) });
  }
  const boundaryPoints: Point[] = [...patternBoundaryPoints, ...circlePoints];

  // Text labels: 2 entries (symbol + measurement in mm for print)
  const labelFs = Math.max(2.5, bigR * 0.15);
  const textAnnotations: TextAnnotation[] = [
    { text: 'D', x: bCx, y: bCy - labelFs * 0.4, fontSize: labelFs },
    { text: `${(2 * bigR).toFixed(0)} mm`, x: bCx, y: bCy + labelFs * 0.7, fontSize: labelFs * 0.82 },
  ];

  const pieces: PatternPiece[] = [
    {
      id: 'main',
      svgPath,  // unrolled polygon only (before base circle was appended)
      boundingBox,  // polygon-only bbox (before extension)
      boundaryPoints: patternBoundaryPoints,
    },
    {
      id: 'base',
      svgPath: baseCirclePath,
      boundingBox: { x: bCx - bigR, y: bCy - bigR, width: 2 * bigR, height: 2 * bigR },
      boundaryPoints: circlePoints,
      textAnnotations,
    },
  ];

  return {
    shape: 'obliqueFrustum',
    slantHeight: maxSlant,
    secondarySlant: h,
    arcAngleDeg: 0,
    arcLength: bottomCirc,
    secondaryArcLength: topCirc,
    outerRadius: bigR,
    innerRadius: smallR,
    svgPath: finalSvgPath,
    boundingBox: extBoundingBox,
    boundaryPoints,
    textAnnotations,
    pieces,
  };
}
