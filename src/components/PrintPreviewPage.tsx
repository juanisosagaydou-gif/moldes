import type { PackedPage, PackedLayout, PlacedPiece, TiledPieceOnPage } from '../types/print';
import { OVERLAP } from '../types/print';

interface PrintPreviewPageProps {
  page: PackedPage;
  layout: PackedLayout;
  pageIndex: number;
  measureLabel: string;
  unit: 'mm' | 'cm';
}

/** SVG transform string for a placed piece */
function placedTransform(p: PlacedPiece): string {
  if (p.rotation === 0) {
    return `translate(${p.pageX - p.bboxX}, ${p.pageY - p.bboxY})`;
  }
  // 90° CW: translate(pageX, pageY + bboxWidth) rotate(90) translate(-bboxX, -bboxY)
  return `translate(${p.pageX}, ${p.pageY + p.bboxWidth}) rotate(90) translate(${-p.bboxX}, ${-p.bboxY})`;
}

/** Reformat value lines (ending with " mm") to the user's unit. */
function formatAnnotText(text: string, unit: 'mm' | 'cm'): string {
  if (unit === 'mm' || !text.endsWith(' mm')) return text;
  const body = text.slice(0, -3); // strip " mm"
  const converted = body.split(' × ').map(part => {
    const n = parseFloat(part);
    return isNaN(n) ? part : (n / 10).toFixed(1);
  });
  return converted.join(' × ') + ' cm';
}

function renderAnnotations(
  annotations: { text: string; x: number; y: number; fontSize: number }[] | undefined,
  strokeWidth: number,
  unit: 'mm' | 'cm',
) {
  if (!annotations?.length) return null;
  return annotations.map((a, i) => (
    <text
      key={i}
      x={a.x}
      y={a.y}
      textAnchor="middle"
      fontSize={a.fontSize}
      fontFamily="'Apple Juice', cursive"
      fill="rgba(60,48,38,0.55)"
      strokeWidth={strokeWidth}
    >
      {formatAnnotText(a.text, unit)}
    </text>
  ));
}

export function PrintPreviewPage({ page, layout, pageIndex, measureLabel, unit }: PrintPreviewPageProps) {
  const { pageWidth, pageHeight, margins } = layout;
  const printW = layout.printableWidth;
  const printH = layout.printableHeight;
  const clipId = `clip-${pageIndex}`;
  const tiled = page.tiled as TiledPieceOnPage | undefined;

  const cropLen = 5;
  const cropStroke = 0.3;
  const totalPages = layout.totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <svg
        width={pageWidth * 0.6}
        height={pageHeight * 0.6}
        viewBox={`0 0 ${pageWidth} ${pageHeight}`}
        style={{
          border: '1px solid rgba(242,235,226,0.30)',
          background: 'white',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        {/* Page background */}
        <rect width={pageWidth} height={pageHeight} fill="white" />

        {/* Margin indicator */}
        <rect
          x={margins} y={margins}
          width={printW} height={printH}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={0.3}
          strokeDasharray="2 2"
        />

        <defs>
          <clipPath id={clipId}>
            <rect x={margins} y={margins} width={printW} height={printH} />
          </clipPath>
        </defs>

        {/* ── Tiled large piece (clipped to printable area) ── */}
        {tiled && (
          <g clipPath={`url(#${clipId})`}>
            <g transform={`translate(${tiled.tx}, ${tiled.ty})`}>
              <g transform={`rotate(${tiled.rotationAngle})`}>
                <path
                  d={tiled.svgPath}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {renderAnnotations(tiled.textAnnotations, 0, unit)}
              </g>
            </g>
          </g>
        )}

        {/* ── Placed small pieces (no clip needed — fit by construction) ── */}
        {page.placed.map((p, i) => (
          <g key={`${p.id}-${i}`} transform={placedTransform(p)}>
            <path
              d={p.svgPath}
              fill="none"
              stroke="#000000"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {renderAnnotations(p.textAnnotations, 0, unit)}
          </g>
        ))}

        {/* Crop marks at corners */}
        <g stroke="#666" strokeWidth={cropStroke}>
          <line x1={margins - cropLen} y1={margins} x2={margins} y2={margins} />
          <line x1={margins} y1={margins - cropLen} x2={margins} y2={margins} />
          <line x1={margins + printW} y1={margins} x2={margins + printW + cropLen} y2={margins} />
          <line x1={margins + printW} y1={margins - cropLen} x2={margins + printW} y2={margins} />
          <line x1={margins - cropLen} y1={margins + printH} x2={margins} y2={margins + printH} />
          <line x1={margins} y1={margins + printH} x2={margins} y2={margins + printH + cropLen} />
          <line x1={margins + printW} y1={margins + printH} x2={margins + printW + cropLen} y2={margins + printH} />
          <line x1={margins + printW} y1={margins + printH} x2={margins + printW} y2={margins + printH + cropLen} />
        </g>

        {/* Measure label */}
        <text x={2} y={pageHeight - 2} textAnchor="start" fontSize={4} fill="#888" fontFamily="sans-serif">
          {measureLabel}
        </text>

        {/* Page number */}
        <text x={pageWidth - 2} y={pageHeight - 2} textAnchor="end" fontSize={4.5} fill="#555" fontFamily="sans-serif">
          {totalPages > 1 ? `${pageIndex + 1}/${totalPages}` : String(pageIndex + 1)}
        </text>

        {/* ── Overlap indicators (only for tiled pages) ── */}
        {tiled && (() => {
          const APPLE = "'Apple Juice', cursive";
          const FS = 4.2;
          const midY = margins + printH / 2;
          const midX = margins + printW / 2;
          // "cortar": cut line — strip between page edge and this line gets discarded
          const leftX = margins + OVERLAP;
          const topY  = margins + OVERLAP;
          // "pegar": paste line — at the physical edge; matches cut edge of next sheet
          const rightX = margins + printW;
          const botY   = margins + printH;

          const IH = 7;
          const IW = 7;
          const IGAP = 2.5;

          // Estimated half-widths of label text at FS=4.2mm Apple Juice
          const CORTAR_HW = 9;
          const PEGAR_HW  = 28;

          // Half-width of the full label zone (text + icons + gap) used to split the line
          const CORTAR_GAP = CORTAR_HW + IGAP + IW + 3;
          const PEGAR_GAP  = PEGAR_HW  + IGAP + IW + 3;

          const SPIRAL   = '/png%20ensamblado/IMG_0685.PNG';
          const SCISSORS = '/png%20ensamblado/IMG_0686.PNG';
          const RED     = '#DF362A';
          const CELESTE = '#5AACCF';

          // Flips icon horizontally around its own bounding box
          const mirrorX = (rx: number) => `translate(${2 * rx + IW}, 0) scale(-1, 1)`;

          return (
            <>
              {/* ── CORTAR left — vertical line at leftX ── */}
              {tiled.hasLeftNeighbor && (
                <g>
                  <rect x={margins} y={margins} width={OVERLAP} height={printH}
                    fill="rgba(223,54,42,0.07)" />
                  {/* Line split into two segments — gap where the label sits */}
                  <line x1={leftX} y1={margins} x2={leftX} y2={midY - CORTAR_GAP}
                    stroke={RED} strokeWidth={0.35} strokeOpacity={0.6} strokeDasharray="3 2" />
                  <line x1={leftX} y1={midY + CORTAR_GAP} x2={leftX} y2={margins + printH}
                    stroke={RED} strokeWidth={0.35} strokeOpacity={0.6} strokeDasharray="3 2" />
                  {/* Label centered ON the line, rotated along it */}
                  <g transform={`rotate(-90, ${leftX}, ${midY})`}>
                    <image href={SCISSORS}
                      x={leftX - CORTAR_HW - IGAP - IW} y={midY - IH / 2}
                      width={IW} height={IH} />
                    <text x={leftX} y={midY + FS * 0.38}
                      textAnchor="middle" fontSize={FS} fontFamily={APPLE}
                      fill={RED} fillOpacity={0.85}>cortar acá</text>
                    <image href={SCISSORS}
                      x={leftX + CORTAR_HW + IGAP} y={midY - IH / 2}
                      width={IW} height={IH}
                      transform={mirrorX(leftX + CORTAR_HW + IGAP)} />
                  </g>
                </g>
              )}

              {/* ── PEGAR right — vertical line at rightX ── */}
              {tiled.hasRightNeighbor && (
                <g>
                  <line x1={rightX} y1={margins} x2={rightX} y2={midY - PEGAR_GAP}
                    stroke={CELESTE} strokeWidth={0.35} strokeOpacity={0.5} strokeDasharray="3 2" />
                  <line x1={rightX} y1={midY + PEGAR_GAP} x2={rightX} y2={margins + printH}
                    stroke={CELESTE} strokeWidth={0.35} strokeOpacity={0.5} strokeDasharray="3 2" />
                  <g transform={`rotate(-90, ${rightX}, ${midY})`}>
                    <image href={SPIRAL}
                      x={rightX - PEGAR_HW - IGAP - IW} y={midY - IH / 2}
                      width={IW} height={IH} />
                    <text x={rightX} y={midY + FS * 0.38}
                      textAnchor="middle" fontSize={FS} fontFamily={APPLE}
                      fill={CELESTE} fillOpacity={0.85}>pegar sobre la línea punteada</text>
                    <image href={SPIRAL}
                      x={rightX + PEGAR_HW + IGAP} y={midY - IH / 2}
                      width={IW} height={IH}
                      transform={mirrorX(rightX + PEGAR_HW + IGAP)} />
                  </g>
                </g>
              )}

              {/* ── CORTAR top — horizontal line at topY ── */}
              {tiled.hasTopNeighbor && (
                <g>
                  <rect x={margins} y={margins} width={printW} height={OVERLAP}
                    fill="rgba(223,54,42,0.07)" />
                  <line x1={margins} y1={topY} x2={midX - CORTAR_GAP} y2={topY}
                    stroke={RED} strokeWidth={0.35} strokeOpacity={0.6} strokeDasharray="3 2" />
                  <line x1={midX + CORTAR_GAP} y1={topY} x2={margins + printW} y2={topY}
                    stroke={RED} strokeWidth={0.35} strokeOpacity={0.6} strokeDasharray="3 2" />
                  <image href={SCISSORS}
                    x={midX - CORTAR_HW - IGAP - IW} y={topY - IH / 2}
                    width={IW} height={IH} />
                  <text x={midX} y={topY + FS * 0.38}
                    textAnchor="middle" fontSize={FS} fontFamily={APPLE}
                    fill={RED} fillOpacity={0.85}>cortar acá</text>
                  <image href={SCISSORS}
                    x={midX + CORTAR_HW + IGAP} y={topY - IH / 2}
                    width={IW} height={IH}
                    transform={mirrorX(midX + CORTAR_HW + IGAP)} />
                </g>
              )}

              {/* ── PEGAR bottom — horizontal line at botY ── */}
              {tiled.hasBottomNeighbor && (
                <g>
                  <line x1={margins} y1={botY} x2={midX - PEGAR_GAP} y2={botY}
                    stroke={CELESTE} strokeWidth={0.35} strokeOpacity={0.5} strokeDasharray="3 2" />
                  <line x1={midX + PEGAR_GAP} y1={botY} x2={margins + printW} y2={botY}
                    stroke={CELESTE} strokeWidth={0.35} strokeOpacity={0.5} strokeDasharray="3 2" />
                  <image href={SPIRAL}
                    x={midX - PEGAR_HW - IGAP - IW} y={botY - IH / 2}
                    width={IW} height={IH} />
                  <text x={midX} y={botY + FS * 0.38}
                    textAnchor="middle" fontSize={FS} fontFamily={APPLE}
                    fill={CELESTE} fillOpacity={0.75}>pegar sobre la línea punteada</text>
                  <image href={SPIRAL}
                    x={midX + PEGAR_HW + IGAP} y={botY - IH / 2}
                    width={IW} height={IH}
                    transform={mirrorX(midX + PEGAR_HW + IGAP)} />
                </g>
              )}
            </>
          );
        })()}
      </svg>

      {/* Page number below thumbnail */}
      <span style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 9,
        color: 'rgba(231,221,219,0.40)',
        letterSpacing: '0.08em',
      }}>
        {pageIndex + 1}
      </span>
    </div>
  );
}
