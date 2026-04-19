import type { ConeInput, PatternPiece, PatternResult, Point } from '../types/geometry';
import { polarToCartesian, sectorBoundingBox } from './geometry-utils';

const GAP = 20; // mm gap between sector and base circle

function circlePath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(3);
  return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
}

export function computeCone(input: ConeInput): PatternResult {
  const { radius: r, height: h } = input;

  // Slant height
  const L = Math.sqrt(h * h + r * r);

  // Arc angle in radians and degrees
  const thetaRad = (r / L) * 2 * Math.PI;
  const thetaDeg = (r / L) * 360;

  // Arc length (circumference of base)
  const arcLength = r * 2 * Math.PI; // = L * thetaRad

  // Sector centered on positive X-axis
  const startAngle = -thetaRad / 2;
  const endAngle = thetaRad / 2;

  const sector = {
    center: { x: 0, y: 0 },
    innerRadius: 0,
    outerRadius: L,
    startAngle,
    endAngle,
  };

  // Build SVG path for sector
  const p1 = polarToCartesian(0, 0, L, startAngle);
  const p2 = polarToCartesian(0, 0, L, endAngle);
  const largeArc = thetaDeg > 180 ? 1 : 0;

  const sectorPath = [
    `M 0 0`,
    `L ${p1.x} ${p1.y}`,
    `A ${L} ${L} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `Z`,
  ].join(' ');

  const sectorBB = sectorBoundingBox(sector);

  // Base circle (radius = r) placed to the right of the sector
  const cx = sectorBB.x + sectorBB.width + GAP + r;
  const cy = sectorBB.y + sectorBB.height / 2;
  const baseCirclePath = circlePath(cx, cy, r);

  const svgPath = sectorPath + ' ' + baseCirclePath;

  // Extended bounding box to include the base circle
  const bbLeft  = sectorBB.x;
  const bbTop   = Math.min(sectorBB.y, cy - r);
  const bbRight = cx + r;
  const bbBottom = Math.max(sectorBB.y + sectorBB.height, cy + r);
  const boundingBox = {
    x: bbLeft,
    y: bbTop,
    width: bbRight - bbLeft,
    height: bbBottom - bbTop,
  };

  // Boundary points for the base circle (sector is handled by the `sector` field in tiling)
  const N = 32;
  const boundaryPoints: Point[] = [];
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    boundaryPoints.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }

  // Text labels centered in base circle: symbol line + measurement line (in mm for print)
  const labelFs = Math.max(2.5, r * 0.15);
  const textAnnotations = [
    { text: 'D', x: cx, y: cy - labelFs * 0.4, fontSize: labelFs },
    { text: `${(2 * r).toFixed(0)} mm`, x: cx, y: cy + labelFs * 0.7, fontSize: labelFs * 0.82 },
  ];

  const pieces: PatternPiece[] = [
    {
      id: 'sector',
      svgPath: sectorPath,
      boundingBox: sectorBB,
      sector,
    },
    {
      id: 'base',
      svgPath: baseCirclePath,
      boundingBox: { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r },
      boundaryPoints,
      textAnnotations,
    },
  ];

  return {
    shape: 'cone',
    sector,
    slantHeight: L,
    arcAngleDeg: thetaDeg,
    arcLength,
    outerRadius: L,
    innerRadius: 0,
    svgPath,
    boundingBox,
    boundaryPoints,
    textAnnotations,
    pieces,
  };
}
