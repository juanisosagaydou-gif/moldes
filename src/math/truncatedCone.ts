import type { TruncatedConeInput, PatternPiece, PatternResult, Point } from '../types/geometry';
import { polarToCartesian, sectorBoundingBox } from './geometry-utils';

const GAP = 20; // mm gap between pieces

function circlePath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(3);
  return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
}

export function computeTruncatedCone(input: TruncatedConeInput): PatternResult {
  let { bottomRadius: R, topRadius: r } = input;
  const { height: h } = input;

  // Ensure R >= r (swap if needed — the development is the same)
  if (r > R) {
    [R, r] = [r, R];
  }

  // Slant height of the truncated portion
  const L = Math.sqrt(h * h + (R - r) * (R - r));

  // Radii in the flat pattern
  const outerRadius = (R * L) / (R - r);
  const innerRadius = (r * L) / (R - r);

  // Arc angle
  const thetaRad = ((R - r) / L) * 2 * Math.PI;
  const thetaDeg = ((R - r) / L) * 360;

  // Arc length (outer)
  const arcLength = outerRadius * thetaRad;

  // Sector centered on positive X-axis
  const startAngle = -thetaRad / 2;
  const endAngle = thetaRad / 2;

  const sector = {
    center: { x: 0, y: 0 },
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
  };

  // Build SVG path: inner start → outer start → outer arc → outer end → inner end → inner arc (reverse)
  const iStart = polarToCartesian(0, 0, innerRadius, startAngle);
  const iEnd   = polarToCartesian(0, 0, innerRadius, endAngle);
  const oStart = polarToCartesian(0, 0, outerRadius, startAngle);
  const oEnd   = polarToCartesian(0, 0, outerRadius, endAngle);
  const largeArc = thetaDeg > 180 ? 1 : 0;

  const sectorPath = [
    `M ${iStart.x} ${iStart.y}`,
    `L ${oStart.x} ${oStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    `Z`,
  ].join(' ');

  const sectorBB = sectorBoundingBox(sector);

  // Bottom base circle (radius R) — placed to the right of the sector
  const cx1 = sectorBB.x + sectorBB.width + GAP + R;
  const cy1 = sectorBB.y + sectorBB.height / 2;
  const botCirclePath = circlePath(cx1, cy1, R);

  // Top base circle (radius r) — placed to the right of the bottom circle
  const cx2 = cx1 + R + GAP + r;
  const cy2 = cy1;
  const topCirclePath = circlePath(cx2, cy2, r);

  const svgPath = sectorPath + ' ' + botCirclePath + ' ' + topCirclePath;

  // Extended bounding box to include both base circles
  const bbLeft  = sectorBB.x;
  const bbTop   = Math.min(sectorBB.y, cy1 - R, cy2 - r);
  const bbRight = cx2 + r;
  const bbBottom = Math.max(sectorBB.y + sectorBB.height, cy1 + R, cy2 + r);
  const boundingBox = {
    x: bbLeft,
    y: bbTop,
    width: bbRight - bbLeft,
    height: bbBottom - bbTop,
  };

  // Boundary points for both base circles (sector is handled by the `sector` field in tiling)
  const N = 32;
  const bottomBP: Point[] = [];
  const topBP: Point[] = [];
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    bottomBP.push({ x: cx1 + R * Math.cos(theta), y: cy1 + R * Math.sin(theta) });
    topBP.push({ x: cx2 + r * Math.cos(theta), y: cy2 + r * Math.sin(theta) });
  }
  const boundaryPoints: Point[] = [...bottomBP, ...topBP];

  // Text labels: 2 entries per circle (symbol + measurement in mm for print)
  const labelFs1 = Math.max(2.5, R * 0.15);
  const labelFs2 = Math.max(2.5, r * 0.15);
  const textAnnotations = [
    { text: 'D', x: cx1, y: cy1 - labelFs1 * 0.4, fontSize: labelFs1 },
    { text: `${(2 * R).toFixed(0)} mm`, x: cx1, y: cy1 + labelFs1 * 0.7, fontSize: labelFs1 * 0.82 },
    { text: 'd', x: cx2, y: cy2 - labelFs2 * 0.4, fontSize: labelFs2 },
    { text: `${(2 * r).toFixed(0)} mm`, x: cx2, y: cy2 + labelFs2 * 0.7, fontSize: labelFs2 * 0.82 },
  ];

  const pieces: PatternPiece[] = [
    {
      id: 'sector',
      svgPath: sectorPath,
      boundingBox: sectorBB,
      sector,
    },
    {
      id: 'base-bottom',
      svgPath: botCirclePath,
      boundingBox: { x: cx1 - R, y: cy1 - R, width: 2 * R, height: 2 * R },
      boundaryPoints: bottomBP,
      textAnnotations: [textAnnotations[0], textAnnotations[1]],
    },
    {
      id: 'base-top',
      svgPath: topCirclePath,
      boundingBox: { x: cx2 - r, y: cy2 - r, width: 2 * r, height: 2 * r },
      boundaryPoints: topBP,
      textAnnotations: [textAnnotations[2], textAnnotations[3]],
    },
  ];

  return {
    shape: 'truncatedCone',
    sector,
    slantHeight: L,
    arcAngleDeg: thetaDeg,
    arcLength,
    outerRadius,
    innerRadius,
    svgPath,
    boundingBox,
    boundaryPoints,
    textAnnotations,
    pieces,
  };
}
