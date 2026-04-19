import type { BoundingBox, ArcSector, PatternPiece, PatternResult, Point } from '../types/geometry';
import type {
  PackedLayout, PackedPage, PlacedPiece,
  PrintConfig, TilingResult, TileDefinition, PageDimensions,
} from '../types/print';
import { PAGE_SIZES, OVERLAP } from '../types/print';
import { rotateBoundingBox, sampleArcPoints } from './geometry-utils';

export function computeTiling(
  bbox: BoundingBox,
  sector: ArcSector | undefined | null,
  config: PrintConfig,
  boundaryPoints?: Point[]
): TilingResult {
  const pageDim = getPageDimensions(config);
  const pw = pageDim.width;
  const ph = pageDim.height;
  const m = config.margins;
  const printableW = pw - 2 * m;
  const printableH = ph - 2 * m;

  // If printable area is too small, still produce at least one tile
  if (printableW <= OVERLAP || printableH <= OVERLAP) {
    return singleTileResult(bbox, 0, pw, ph, printableW, printableH, m);
  }

  // Find optimal rotation
  const angles = [0, 15, 30, 45, 60, 75, 90, -15, -30, -45, -60, -75, -90];
  let bestAngle = 0;
  let bestPages = Infinity;
  let bestBBox = bbox;

  for (const angle of angles) {
    const rotBBox = angle === 0 ? bbox : rotateBoundingBox(bbox, angle);
    const pages = computePageCount(rotBBox, printableW, printableH);
    if (pages < bestPages) {
      bestPages = pages;
      bestAngle = angle;
      bestBBox = rotBBox;
    }
  }

  // Compute tile grid
  const cols = Math.max(1, Math.ceil((bestBBox.width - OVERLAP) / (printableW - OVERLAP)));
  const rows = Math.max(1, Math.ceil((bestBBox.height - OVERLAP) / (printableH - OVERLAP)));

  // Fixed step so the actual overlap between adjacent tiles always equals OVERLAP,
  // matching the guide lines drawn on each page. The tile at col/row=0 always
  // starts at bestBBox.x/y, so when cols=1 or rows=1 the step value doesn't matter.
  const stepX = printableW - OVERLAP;
  const stepY = printableH - OVERLAP;

  // Build tiles and cull empty ones
  const allTiles: TileDefinition[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const vx = bestBBox.x + col * stepX;
      const vy = bestBBox.y + row * stepY;

      const tile: TileDefinition = {
        col,
        row,
        viewportX: vx,
        viewportY: vy,
        viewportWidth: printableW,
        viewportHeight: printableH,
        hasLeftNeighbor: col > 0,
        hasRightNeighbor: col < cols - 1,
        hasTopNeighbor: row > 0,
        hasBottomNeighbor: row < rows - 1,
      };

      // Check if tile intersects the pattern
      if (tileIntersectsPattern(tile, sector, bestAngle, boundaryPoints)) {
        allTiles.push(tile);
      }
    }
  }

  // If no tiles passed the intersection test, keep at least the first tile
  const tiles = allTiles.length > 0 ? allTiles : [{
    col: 0, row: 0,
    viewportX: bestBBox.x, viewportY: bestBBox.y,
    viewportWidth: printableW, viewportHeight: printableH,
    hasLeftNeighbor: false, hasRightNeighbor: false,
    hasTopNeighbor: false, hasBottomNeighbor: false,
  }];

  return {
    rotationAngle: bestAngle,
    rotatedBBox: bestBBox,
    tiles,
    gridCols: cols,
    gridRows: rows,
    totalPages: tiles.length,
    pageWidth: pw,
    pageHeight: ph,
    printableWidth: printableW,
    printableHeight: printableH,
    margins: m,
  };
}

function getPageDimensions(config: PrintConfig): PageDimensions {
  const base = PAGE_SIZES[config.pageSize];
  if (config.orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return { ...base };
}

function computePageCount(bbox: BoundingBox, printW: number, printH: number): number {
  if (bbox.width <= printW && bbox.height <= printH) return 1;
  const cols = Math.max(1, Math.ceil((bbox.width - OVERLAP) / (printW - OVERLAP)));
  const rows = Math.max(1, Math.ceil((bbox.height - OVERLAP) / (printH - OVERLAP)));
  return cols * rows;
}

function singleTileResult(
  bbox: BoundingBox, angle: number,
  pw: number, ph: number, printW: number, printH: number, margins: number
): TilingResult {
  return {
    rotationAngle: angle,
    rotatedBBox: bbox,
    tiles: [{
      col: 0, row: 0,
      viewportX: bbox.x, viewportY: bbox.y,
      viewportWidth: printW, viewportHeight: printH,
      hasLeftNeighbor: false, hasRightNeighbor: false,
      hasTopNeighbor: false, hasBottomNeighbor: false,
    }],
    gridCols: 1, gridRows: 1, totalPages: 1,
    pageWidth: pw, pageHeight: ph,
    printableWidth: printW, printableHeight: printH,
    margins,
  };
}

/**
 * Check if a tile rectangle intersects the pattern.
 * For arc-based shapes (cones): samples along arcs and radii.
 * For polygon-based shapes: samples boundary points.
 */
function tileIntersectsPattern(
  tile: TileDefinition,
  sector: ArcSector | undefined | null,
  rotationAngle: number,
  boundaryPoints?: Point[]
): boolean {
  const rad = (rotationAngle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const tileLeft = tile.viewportX;
  const tileRight = tile.viewportX + tile.viewportWidth;
  const tileTop = tile.viewportY;
  const tileBottom = tile.viewportY + tile.viewportHeight;

  const inTile = (x: number, y: number) =>
    x >= tileLeft && x <= tileRight && y >= tileTop && y <= tileBottom;

  const rotate = (x: number, y: number) => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  });

  // Check boundary points (polygon shapes and base circles/rects added to arc patterns)
  if (boundaryPoints && boundaryPoints.length > 0) {
    for (const p of boundaryPoints) {
      const rp = rotate(p.x, p.y);
      if (inTile(rp.x, rp.y)) return true;
    }
    // If no boundary point matched and there is no sector to further check, tile is empty
    if (!sector) return false;
  }

  // Arc-based shapes: sample sector arcs and radii
  if (!sector) return true; // no intersection data at all — include tile as fallback

  // Sample outer arc
  const outerPoints = sampleArcPoints(
    sector.center.x, sector.center.y, sector.outerRadius,
    sector.startAngle, sector.endAngle, 90
  );
  for (const p of outerPoints) {
    const rp = rotate(p.x, p.y);
    if (inTile(rp.x, rp.y)) return true;
  }

  // Sample inner arc (if truncated cone)
  if (sector.innerRadius > 0) {
    const innerPoints = sampleArcPoints(
      sector.center.x, sector.center.y, sector.innerRadius,
      sector.startAngle, sector.endAngle, 90
    );
    for (const p of innerPoints) {
      const rp = rotate(p.x, p.y);
      if (inTile(rp.x, rp.y)) return true;
    }
  }

  // Sample the two straight edges (radii)
  const numRadiusSamples = 30;
  for (let i = 0; i <= numRadiusSamples; i++) {
    const t = i / numRadiusSamples;
    const r = sector.innerRadius + t * (sector.outerRadius - sector.innerRadius);
    for (const angle of [sector.startAngle, sector.endAngle]) {
      const x = sector.center.x + r * Math.cos(angle);
      const y = sector.center.y + r * Math.sin(angle);
      const rp = rotate(x, y);
      if (inTile(rp.x, rp.y)) return true;
    }
  }

  // Also check the center/apex for cones
  if (sector.innerRadius === 0) {
    const rp = rotate(sector.center.x, sector.center.y);
    if (inTile(rp.x, rp.y)) return true;
  }

  return false;
}

// ─── Packed layout ────────────────────────────────────────────────────────────

const PIECE_GAP = 15; // mm between pieces placed on the same page

/** State for placing pieces in a zone of a page via a simple shelf algorithm */
interface ShelfState {
  /** Top of the current shelf in page mm coords (from page top = 0) */
  shelfY: number;
  /** Max height of items placed on the current shelf */
  shelfMaxH: number;
  /** Width used on the current shelf (in printable coords) */
  shelfUsedW: number;
  /** Maximum Y allowed (page mm) — pieces must not go past this */
  maxPageY: number;
  /** Printable width */
  printW: number;
  /** Page left margin (= margins) */
  marginX: number;
}

/** Try to place a piece (of the given dimensions) on the shelf. Returns the
 *  (pageX, pageY) position if successful, or null if it doesn't fit. */
function tryShelfPlace(
  s: ShelfState,
  pieceW: number,
  pieceH: number,
): { pageX: number; pageY: number } | null {
  // Try fitting on the current shelf
  if (s.shelfUsedW + pieceW <= s.printW && s.shelfY + pieceH <= s.maxPageY) {
    const pos = { pageX: s.marginX + s.shelfUsedW, pageY: s.shelfY };
    s.shelfUsedW += pieceW + PIECE_GAP;
    s.shelfMaxH = Math.max(s.shelfMaxH, pieceH);
    return pos;
  }
  // Try opening a new shelf below
  const nextShelfY = s.shelfY + s.shelfMaxH + PIECE_GAP;
  if (pieceW <= s.printW && nextShelfY + pieceH <= s.maxPageY) {
    s.shelfY = nextShelfY;
    s.shelfMaxH = pieceH;
    s.shelfUsedW = pieceW + PIECE_GAP;
    return { pageX: s.marginX, pageY: nextShelfY };
  }
  return null;
}

/** Returns effective (width, height) of a piece after applying the given rotation */
function rotatedDims(p: PatternPiece, rotation: 0 | 90): { w: number; h: number } {
  return rotation === 0
    ? { w: p.boundingBox.width, h: p.boundingBox.height }
    : { w: p.boundingBox.height, h: p.boundingBox.width };
}

/** Pick the best rotation for a piece to fit in the available area.
 *  Returns null if neither orientation fits at all. */
function chooseFitRotation(
  p: PatternPiece,
  printW: number,
  printH: number,
): 0 | 90 | null {
  const { width: bw, height: bh } = p.boundingBox;
  if (bw <= printW && bh <= printH) return 0;
  if (bh <= printW && bw <= printH) return 90;
  return null;
}

/**
 * Intelligent bin-packing print layout.
 *
 * Each piece (sector, circle, face panel…) is treated individually.
 * Pieces that don't fit on a single page are tiled using the existing
 * computeTiling logic. Small pieces are packed with a shelf algorithm,
 * reusing the free vertical space on tiled pages when possible.
 */
export function computePackedLayout(
  pattern: PatternResult,
  config: PrintConfig,
): PackedLayout {
  const pageDim = getPageDimensions(config);
  const pw = pageDim.width;
  const ph = pageDim.height;
  const m = config.margins;
  const printW = pw - 2 * m;
  const printH = ph - 2 * m;

  const pieces = pattern.pieces;

  // Fallback: no pieces metadata → wrap the whole pattern as a single tiled item
  if (!pieces || pieces.length === 0) {
    const tiling = computeTiling(pattern.boundingBox, pattern.sector ?? null, config, pattern.boundaryPoints);
    const pages: PackedPage[] = tiling.tiles.map(tile => ({
      placed: [],
      tiled: {
        id: 'main',
        svgPath: pattern.svgPath,
        textAnnotations: pattern.textAnnotations,
        rotationAngle: tiling.rotationAngle,
        tx: m - tile.viewportX,
        ty: m - tile.viewportY,
        rotatedBBox: tiling.rotatedBBox,
        hasLeftNeighbor: tile.hasLeftNeighbor,
        hasRightNeighbor: tile.hasRightNeighbor,
        hasTopNeighbor: tile.hasTopNeighbor,
        hasBottomNeighbor: tile.hasBottomNeighbor,
        col: tile.col,
        row: tile.row,
        gridCols: tiling.gridCols,
        gridRows: tiling.gridRows,
      },
    }));
    return { pages, pageWidth: pw, pageHeight: ph, margins: m, printableWidth: printW, printableHeight: printH, totalPages: pages.length };
  }

  // Classify pieces: those that need tiling vs those that can be bin-packed
  const largePieces: PatternPiece[] = [];
  const smallPieces: PatternPiece[] = [];
  for (const p of pieces) {
    if (chooseFitRotation(p, printW, printH) !== null) {
      smallPieces.push(p);
    } else {
      largePieces.push(p);
    }
  }

  // Sort small pieces by area descending (tallest/largest first = better packing)
  smallPieces.sort((a, b) =>
    b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height
  );

  const pages: PackedPage[] = [];
  const shelfStates: ShelfState[] = [];

  // ── 1. Create tiled pages for each large piece ───────────────────────────
  for (const lp of largePieces) {
    const tiling = computeTiling(lp.boundingBox, lp.sector ?? null, config, lp.boundaryPoints);
    for (const tile of tiling.tiles) {
      const tx = m - tile.viewportX;
      const ty = m - tile.viewportY;

      // Compute the bottom of the pattern content on this page (page mm)
      const contentBottom = Math.min(
        ty + tiling.rotatedBBox.y + tiling.rotatedBBox.height,
        m + printH,
      );
      // Free zone below the tiled content
      const freeZoneTop = contentBottom + PIECE_GAP; // page mm
      const freeZoneH = (m + printH) - freeZoneTop;

      pages.push({
        placed: [],
        tiled: {
          id: lp.id,
          svgPath: lp.svgPath,
          textAnnotations: lp.textAnnotations,
          rotationAngle: tiling.rotationAngle,
          tx,
          ty,
          rotatedBBox: tiling.rotatedBBox,
          hasLeftNeighbor: tile.hasLeftNeighbor,
          hasRightNeighbor: tile.hasRightNeighbor,
          hasTopNeighbor: tile.hasTopNeighbor,
          hasBottomNeighbor: tile.hasBottomNeighbor,
          col: tile.col,
          row: tile.row,
          gridCols: tiling.gridCols,
          gridRows: tiling.gridRows,
        },
      });

      // Only register a free shelf if there is meaningful space below the tile content
      shelfStates.push(
        freeZoneH >= 30
          ? { shelfY: freeZoneTop, shelfMaxH: 0, shelfUsedW: 0, maxPageY: m + printH, printW, marginX: m }
          : { shelfY: m + printH, shelfMaxH: 0, shelfUsedW: 0, maxPageY: m + printH, printW, marginX: m },
      );
    }
  }

  // ── 2. Bin-pack small pieces ─────────────────────────────────────────────
  for (const sp of smallPieces) {
    let placed = false;

    // Try existing pages (tiled and free pages) in order
    for (let i = 0; i < pages.length && !placed; i++) {
      const s = shelfStates[i];

      // Try both orientations; prefer 0° first
      const rotations: Array<0 | 90> = [0, 90];
      for (const rot of rotations) {
        const { w, h } = rotatedDims(sp, rot);
        const pos = tryShelfPlace(s, w, h);
        if (pos) {
          pages[i].placed.push(makePlacedPiece(sp, pos.pageX, pos.pageY, rot));
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      // Open a new free page
      const rot = chooseFitRotation(sp, printW, printH) ?? 0;
      const { w, h } = rotatedDims(sp, rot);
      const newState: ShelfState = {
        shelfY: m,
        shelfMaxH: h,
        shelfUsedW: w + PIECE_GAP,
        maxPageY: m + printH,
        printW,
        marginX: m,
      };
      const newPage: PackedPage = { placed: [], tiled: undefined };
      newPage.placed.push(makePlacedPiece(sp, m, m, rot));
      pages.push(newPage);
      shelfStates.push(newState);
    }
  }

  return {
    pages,
    pageWidth: pw,
    pageHeight: ph,
    margins: m,
    printableWidth: printW,
    printableHeight: printH,
    totalPages: pages.length,
  };
}

function makePlacedPiece(
  p: PatternPiece,
  pageX: number,
  pageY: number,
  rotation: 0 | 90,
): PlacedPiece {
  return {
    id: p.id,
    svgPath: p.svgPath,
    textAnnotations: p.textAnnotations,
    pageX,
    pageY,
    bboxX: p.boundingBox.x,
    bboxY: p.boundingBox.y,
    bboxWidth: p.boundingBox.width,
    rotation,
  };
}
