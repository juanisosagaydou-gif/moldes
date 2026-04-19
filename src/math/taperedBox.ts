import type { TaperedBoxInput, PatternPiece, PatternResult, Point, TextAnnotation } from '../types/geometry';

/**
 * Build an isosceles trapezoid SVG path offset to a given (ox, oy) origin.
 * The trapezoid has:
 *   - bottom edge of length `a` (wider), centered at ox + a/2
 *   - top edge of length `b` (narrower), centered at ox + a/2
 *   - height `h2d` (2D slant height of the face)
 *
 * The path starts at the bottom-left corner and goes clockwise.
 */
function trapezoidPath(ox: number, oy: number, a: number, b: number, h2d: number): string {
  const cx = ox + a / 2;
  const x0 = cx - a / 2;
  const x1 = cx + a / 2;
  const x2 = cx + b / 2;
  const x3 = cx - b / 2;
  const f = (n: number) => n.toFixed(3);
  return `M ${f(x0)} ${f(oy)} L ${f(x1)} ${f(oy)} L ${f(x2)} ${f(oy + h2d)} L ${f(x3)} ${f(oy + h2d)} Z`;
}

/**
 * Build a rectangle SVG path at (ox, oy) with given width and height.
 */
function rectPath(ox: number, oy: number, w: number, h: number): string {
  const f = (n: number) => n.toFixed(3);
  return `M ${f(ox)} ${f(oy)} L ${f(ox + w)} ${f(oy)} L ${f(ox + w)} ${f(oy + h)} L ${f(ox)} ${f(oy + h)} Z`;
}

/**
 * Compute the 2D mold for a tapered rectangular box (square frustum / truncated pyramid).
 *
 * Generates 5 pieces arranged in a single row:
 *   1. Base rectangle (W_b × L_b)
 *   2. Front face trapezoid ×2 (bottom = W_b, top = W_t, height = s_front)
 *   3. Side face trapezoid ×2  (bottom = L_b, top = L_t, height = s_side)
 *
 * All pieces share y = 0 as the bottom edge baseline.
 *
 * The slant heights are:
 *   s_front = sqrt(h² + ((L_b - L_t)/2)²)  — perpendicular slant of front/back faces
 *   s_side  = sqrt(h² + ((W_b - W_t)/2)²)  — perpendicular slant of left/right faces
 */
export function computeTaperedBox(input: TaperedBoxInput): PatternResult {
  const { bottomWidth: W_b, bottomLength: L_b, topWidth: W_t, topLength: L_t, height: h } = input;

  const s_front = Math.sqrt(h * h + ((L_b - L_t) / 2) ** 2);
  const s_side = Math.sqrt(h * h + ((W_b - W_t) / 2) ** 2);

  // Gap scales with the largest piece dimension so small-mm patterns stay compact
  const maxDim = Math.max(W_b, L_b, W_t, L_t, s_front, s_side);
  const GAP = Math.max(1, maxDim * 0.15);

  // Layout: pieces placed left-to-right with GAP between them
  // All pieces have y=0 at baseline, growing upward (positive y)
  // For inverted boxes (W_t > W_b or L_t > L_b) the trapezoid is wider at the
  // top, so we must allocate max(bottom, top) width and shift the ox so the
  // piece is centred within its slot, preventing overlaps.
  const oy = 0;

  const frontSlot = Math.max(W_b, W_t); // slot width for front/back pieces
  const sideSlot  = Math.max(L_b, L_t); // slot width for side pieces

  // Piece 1: Base rectangle
  let cursor = 0;
  const baseOx = cursor;
  const basePath = rectPath(baseOx, oy, W_b, L_b);
  cursor += W_b + GAP;

  // Pieces 2 & 3: Front face trapezoids (bottom=W_b, top=W_t)
  // Shift ox right by half the difference so the wider edge stays within slot
  const front1SlotX = cursor;
  const front1Ox = cursor + (frontSlot - W_b) / 2;
  const front1Path = trapezoidPath(front1Ox, oy, W_b, W_t, s_front);
  cursor += frontSlot + GAP;

  const front2SlotX = cursor;
  const front2Ox = cursor + (frontSlot - W_b) / 2;
  const front2Path = trapezoidPath(front2Ox, oy, W_b, W_t, s_front);
  cursor += frontSlot + GAP;

  // Pieces 4 & 5: Side face trapezoids (bottom=L_b, top=L_t)
  const side1SlotX = cursor;
  const side1Ox = cursor + (sideSlot - L_b) / 2;
  const side1Path = trapezoidPath(side1Ox, oy, L_b, L_t, s_side);
  cursor += sideSlot + GAP;

  const side2SlotX = cursor;
  const side2Ox = cursor + (sideSlot - L_b) / 2;
  const side2Path = trapezoidPath(side2Ox, oy, L_b, L_t, s_side);
  cursor += sideSlot + GAP;

  // Piece 6: Top base rectangle
  const topBaseOx = cursor;
  const topBasePath = rectPath(topBaseOx, oy, W_t, L_t);
  cursor += W_t;

  // Combined SVG path (all 6 pieces as separate M...Z sub-paths)
  const svgPath = [basePath, front1Path, front2Path, side1Path, side2Path, topBasePath].join(' ');

  // Total bounding box
  const totalWidth = cursor;
  const totalHeight = Math.max(L_b, s_front, s_side, L_t);
  const boundingBox = { x: 0, y: 0, width: totalWidth, height: totalHeight };

  // Boundary points for tiling intersection (corners of each piece)
  const boundaryPoints: Point[] = [];
  const addRect = (ox: number, w: number, h2: number) => {
    boundaryPoints.push({ x: ox, y: 0 }, { x: ox + w, y: 0 }, { x: ox + w, y: h2 }, { x: ox, y: h2 });
  };
  const addTrap = (ox: number, a: number, b: number, h2d: number) => {
    const cx = ox + a / 2;
    boundaryPoints.push(
      { x: cx - a / 2, y: 0 }, { x: cx + a / 2, y: 0 },
      { x: cx + b / 2, y: h2d }, { x: cx - b / 2, y: h2d }
    );
  };

  addRect(baseOx, W_b, L_b);
  addTrap(front1Ox, W_b, W_t, s_front);
  addTrap(front2Ox, W_b, W_t, s_front);
  addTrap(side1Ox, L_b, L_t, s_side);
  addTrap(side2Ox, L_b, L_t, s_side);
  addRect(topBaseOx, W_t, L_t);

  // Text labels: 2 entries per base (symbol + measurement in mm for print)
  const botLabelFs = Math.max(2.5, Math.min(W_b, L_b) * 0.10);
  const topLabelFs = Math.max(2.5, Math.min(W_t, L_t) * 0.10);
  const textAnnotations: TextAnnotation[] = [
    { text: 'W × L', x: baseOx + W_b / 2, y: L_b / 2 - botLabelFs * 0.5, fontSize: botLabelFs },
    { text: `${W_b.toFixed(0)} × ${L_b.toFixed(0)} mm`, x: baseOx + W_b / 2, y: L_b / 2 + botLabelFs * 0.7, fontSize: botLabelFs * 0.82 },
    { text: 'w × l', x: topBaseOx + W_t / 2, y: L_t / 2 - topLabelFs * 0.5, fontSize: topLabelFs },
    { text: `${W_t.toFixed(0)} × ${L_t.toFixed(0)} mm`, x: topBaseOx + W_t / 2, y: L_t / 2 + topLabelFs * 0.7, fontSize: topLabelFs * 0.82 },
  ];

  // Individual pieces for intelligent print packing
  // Each piece bbox x = slot-start (min x of that piece in combined layout)
  const pieces: PatternPiece[] = [
    {
      id: 'base-bottom',
      svgPath: basePath,
      boundingBox: { x: 0, y: 0, width: W_b, height: L_b },
      textAnnotations: [textAnnotations[0], textAnnotations[1]],
    },
    {
      id: 'front-1',
      svgPath: front1Path,
      boundingBox: { x: front1SlotX, y: 0, width: frontSlot, height: s_front },
    },
    {
      id: 'front-2',
      svgPath: front2Path,
      boundingBox: { x: front2SlotX, y: 0, width: frontSlot, height: s_front },
    },
    {
      id: 'side-1',
      svgPath: side1Path,
      boundingBox: { x: side1SlotX, y: 0, width: sideSlot, height: s_side },
    },
    {
      id: 'side-2',
      svgPath: side2Path,
      boundingBox: { x: side2SlotX, y: 0, width: sideSlot, height: s_side },
    },
    {
      id: 'base-top',
      svgPath: topBasePath,
      boundingBox: { x: topBaseOx, y: 0, width: W_t, height: L_t },
      textAnnotations: [textAnnotations[2], textAnnotations[3]],
    },
  ];

  // Computed measurements
  const bottomPerimeter = 2 * (W_b + L_b);
  const topPerimeter = 2 * (W_t + L_t);

  return {
    shape: 'taperedBox',
    slantHeight: s_front,
    secondarySlant: s_side,
    arcAngleDeg: 0,
    arcLength: bottomPerimeter,
    secondaryArcLength: topPerimeter,
    outerRadius: W_b,
    innerRadius: W_t,
    svgPath,
    boundingBox,
    boundaryPoints,
    textAnnotations,
    pieces,
  };
}
