import type { Point, BoundingBox, ArcSector } from '../types/geometry';

export function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number): Point {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Compute the axis-aligned bounding box of a circular/annular sector.
 * Checks arc endpoints plus any axis crossings (0°, 90°, 180°, 270°).
 */
export function sectorBoundingBox(sector: ArcSector): BoundingBox {
  const { center, innerRadius, outerRadius, startAngle, endAngle } = sector;
  const points: Point[] = [];

  // If innerRadius is 0 (cone), include the center/apex
  if (innerRadius === 0) {
    points.push(center);
  }

  // Endpoints of outer arc
  points.push(polarToCartesian(center.x, center.y, outerRadius, startAngle));
  points.push(polarToCartesian(center.x, center.y, outerRadius, endAngle));

  // Endpoints of inner arc (truncated cone)
  if (innerRadius > 0) {
    points.push(polarToCartesian(center.x, center.y, innerRadius, startAngle));
    points.push(polarToCartesian(center.x, center.y, innerRadius, endAngle));
  }

  // Check axis crossings: 0, π/2, π, 3π/2
  const axisAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (const axis of axisAngles) {
    if (angleInSector(axis, startAngle, endAngle)) {
      points.push(polarToCartesian(center.x, center.y, outerRadius, axis));
      if (innerRadius > 0) {
        points.push(polarToCartesian(center.x, center.y, innerRadius, axis));
      }
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Check if an angle lies within the sector [startAngle, endAngle].
 * Handles the case where the sector wraps around 2π.
 */
function angleInSector(angle: number, start: number, end: number): boolean {
  // Normalize all angles to [0, 2π)
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const a = norm(angle);
  const s = norm(start);
  const e = norm(end);

  if (s <= e) {
    return a >= s && a <= e;
  } else {
    // Wraps around 0
    return a >= s || a <= e;
  }
}

/**
 * Rotate a bounding box by a given angle (degrees) around the origin
 * and return the new AABB.
 */
export function rotateBoundingBox(bbox: BoundingBox, angleDeg: number): BoundingBox {
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Four corners of the bbox
  const corners: Point[] = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    { x: bbox.x, y: bbox.y + bbox.height },
  ];

  const rotated = corners.map(p => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of rotated) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Sample points along an arc for intersection testing.
 */
export function sampleArcPoints(
  cx: number, cy: number, radius: number,
  startAngle: number, endAngle: number,
  numSamples: number = 72
): Point[] {
  const points: Point[] = [];
  const step = (endAngle - startAngle) / numSamples;
  for (let i = 0; i <= numSamples; i++) {
    const angle = startAngle + step * i;
    points.push(polarToCartesian(cx, cy, radius, angle));
  }
  return points;
}
