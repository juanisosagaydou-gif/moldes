export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArcSector {
  center: Point;
  innerRadius: number;
  outerRadius: number;
  startAngle: number; // radians
  endAngle: number;   // radians
}

export type ShapeType = 'cone' | 'truncatedCone' | 'obliqueFrustum' | 'taperedBox';

export interface ConeInput {
  radius: number;  // mm
  height: number;  // mm
}

export interface TruncatedConeInput {
  bottomRadius: number; // mm
  topRadius: number;    // mm
  height: number;       // mm
}

export interface ObliqueFrustumInput {
  bottomRadius: number; // mm (already halved from diameter)
  topRadius: number;    // mm
  height: number;       // mm
}

export interface TaperedBoxInput {
  bottomWidth: number;  // mm
  bottomLength: number; // mm
  topWidth: number;     // mm
  topLength: number;    // mm
  height: number;       // mm
}

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

/** One discrete cut piece of the pattern (sector, circle, trapezoid face, etc.) */
export interface PatternPiece {
  id: string;
  svgPath: string;
  boundingBox: BoundingBox;
  textAnnotations?: TextAnnotation[];
  /** Arc sector metadata — only for the main arc-sector piece (used by tiling intersection test) */
  sector?: ArcSector;
  /** Polygon boundary points for tiling intersection test */
  boundaryPoints?: Point[];
}

export interface PatternResult {
  shape: ShapeType;
  sector?: ArcSector;          // only for cone / truncatedCone
  slantHeight: number;         // primary slant (max for jug, front face for box)
  secondarySlant?: number;     // secondary slant (jug: straight side = h; box: side face slant)
  arcAngleDeg: number;         // 0 for non-arc shapes
  arcLength: number;           // arc length (cones) / bottom circumference (jug) / bottom perimeter (box)
  secondaryArcLength?: number; // top circumference (jug) / top perimeter (box)
  outerRadius: number;
  innerRadius: number;
  svgPath: string;
  boundingBox: BoundingBox;
  boundaryPoints?: Point[];    // polygon outline for non-arc shapes + base shape outlines (tiling)
  textAnnotations?: TextAnnotation[]; // labels centered in base pieces
  /** Individual pieces used for intelligent print packing */
  pieces?: PatternPiece[];
}
