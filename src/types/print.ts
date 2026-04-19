import type { TextAnnotation } from './geometry';

export type PageSize = 'A4' | 'A3';
export type Orientation = 'portrait' | 'landscape';

export interface PageDimensions {
  width: number;  // mm
  height: number; // mm
}

export const PAGE_SIZES: Record<PageSize, PageDimensions> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
};

export interface PrintConfig {
  pageSize: PageSize;
  orientation: Orientation;
  margins: number; // mm, applied to all sides
}

export interface TileDefinition {
  col: number;
  row: number;
  viewportX: number;
  viewportY: number;
  viewportWidth: number;
  viewportHeight: number;
  hasLeftNeighbor: boolean;
  hasRightNeighbor: boolean;
  hasTopNeighbor: boolean;
  hasBottomNeighbor: boolean;
}

export interface TilingResult {
  rotationAngle: number;
  rotatedBBox: { x: number; y: number; width: number; height: number };
  tiles: TileDefinition[];
  gridCols: number;
  gridRows: number;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  printableWidth: number;
  printableHeight: number;
  margins: number;
}

export const OVERLAP = 10; // mm

// ─── Packed layout (intelligent piece-aware print packing) ───────────────────

/**
 * A small piece placed directly on a page (fits within printable area).
 * Rendered with: translate(pageX − bboxX, pageY − bboxY)
 * For rotation=90 (CW): translate(pageX, pageY + bboxWidth) rotate(90) translate(−bboxX, −bboxY)
 */
export interface PlacedPiece {
  id: string;
  svgPath: string;
  textAnnotations?: TextAnnotation[];
  /** Target top-left corner on page in page mm (from 0,0) */
  pageX: number;
  pageY: number;
  /** Original bbox origin — needed to compute the translate offset */
  bboxX: number;
  bboxY: number;
  /** Original bbox width — needed for 90° rotation offset */
  bboxWidth: number;
  /** 0 = no rotation, 90 = 90° clockwise rotation applied */
  rotation: 0 | 90;
}

/**
 * A large piece that required multi-page tiling (tile window into the pattern).
 * Rendered exactly like the old TilingResult tile: clip + translate + rotate.
 */
export interface TiledPieceOnPage {
  id: string;
  svgPath: string;
  textAnnotations?: TextAnnotation[];
  rotationAngle: number;
  /** translate(tx, ty) in page mm coords — same formula as before: margins − viewportX/Y */
  tx: number;
  ty: number;
  /** Rotated bounding box of the piece — used to compute free space on page */
  rotatedBBox: { x: number; y: number; width: number; height: number };
  hasLeftNeighbor: boolean;
  hasRightNeighbor: boolean;
  hasTopNeighbor: boolean;
  hasBottomNeighbor: boolean;
  col: number;
  row: number;
  gridCols: number;
  gridRows: number;
}

export interface PackedPage {
  /** Large piece shown through a tile window (may be undefined for free-only pages) */
  tiled?: TiledPieceOnPage;
  /** Small pieces placed directly on this page */
  placed: PlacedPiece[];
}

export interface PackedLayout {
  pages: PackedPage[];
  pageWidth: number;
  pageHeight: number;
  margins: number;
  printableWidth: number;
  printableHeight: number;
  totalPages: number;
}
