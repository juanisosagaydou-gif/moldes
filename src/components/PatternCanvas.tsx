import { useTranslation } from '../i18n/useTranslation';
import { useAppState, useActiveItem } from '../state/appContext';
import type { PatternResult } from '../types/geometry';
import type { PackedLayout } from '../types/print';

interface PatternCanvasProps {
  pattern: PatternResult | null;
  tiling: PackedLayout | null;
}

const PADDING_RATIO = 0.08;
const ANNOT_COLOR = 'rgba(60,48,38,0.45)';

// Fixed visual constants — all shapes render at the same size regardless of mm
const SHAPE_SVG   = 72;  // px — SVG canvas for each base slot
const SHAPE_MAX   = 54;  // px — max diameter / bounding box for circle or rect
const CARD_W      = 160; // px — card width, same for all shapes

// Converts input string (in current unit) to mm
function toMm(value: string, unit: 'mm' | 'cm'): number {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return 0;
  return unit === 'cm' ? n * 10 : n;
}

// Scales a rect to fit within SHAPE_MAX × SHAPE_MAX, preserving aspect ratio
function rectPx(wMm: number, lMm: number): { w: number; l: number } {
  if (wMm <= 0 || lMm <= 0) return { w: SHAPE_MAX, l: SHAPE_MAX };
  const ratio = wMm / lMm;
  return ratio >= 1
    ? { w: SHAPE_MAX, l: Math.round(SHAPE_MAX / ratio) }
    : { w: Math.round(SHAPE_MAX * ratio), l: SHAPE_MAX };
}

export function PatternCanvas({ pattern }: PatternCanvasProps) {
  const { t } = useTranslation();
  const { state } = useAppState();
  const activeItem = useActiveItem();

  if (!pattern) {
    return (
      <div
        className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 border border-dashed rounded"
        style={{ background: '#F4EDE1', borderColor: 'rgba(60,48,38,0.25)' }}
      >
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-10 h-10" style={{ color: 'rgba(60,48,38,0.18)' }}>
          <path d="M24 6 L42 42 H6 Z" strokeLinejoin="round" />
        </svg>
        <p className="text-[11px] tracking-wide text-center px-6" style={{ color: 'rgba(60,48,38,0.4)' }}>
          {t('preview.emptyHint')}
        </p>
      </div>
    );
  }

  const hasSector = !!pattern.sector;
  const { slantHeight, outerRadius } = pattern;
  const { unit } = state;
  const { inputs } = activeItem;

  // In the 2D viewer, show only non-base pieces (base shapes are shown in the card)
  const nonBasePieces = pattern.pieces?.filter(p => !p.id.startsWith('base')) ?? [];
  const displayPath = nonBasePieces.length > 0
    ? nonBasePieces.map(p => p.svgPath).join(' ')
    : pattern.svgPath;

  // Recompute bounding box from visible pieces only
  const bb = (() => {
    if (nonBasePieces.length === 0) return pattern.boundingBox;
    const xs = nonBasePieces.flatMap(p => [p.boundingBox.x, p.boundingBox.x + p.boundingBox.width]);
    const ys = nonBasePieces.flatMap(p => [p.boundingBox.y, p.boundingBox.y + p.boundingBox.height]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  })();

  const refSize = Math.max(bb.width, bb.height);
  const pad = refSize * PADDING_RATIO;
  const vx = bb.x - pad;
  const vy = bb.y - pad;
  const vw = bb.width + pad * 2;
  const vh = bb.height + pad * 2;

  // Annotation sizing — refSize * 0.5 keeps visual size identical across all shapes
  const annotRef = refSize * 0.5;
  const annotFs = annotRef * 0.048;
  const tickLen = annotRef * 0.032;
  const dash = `${annotRef * 0.022} ${annotRef * 0.014}`;

  const fmt = (mm: number) =>
    unit === 'cm' ? `${(mm / 10).toFixed(1)} cm` : `${mm.toFixed(0)} mm`;

  // ─── Arc-shape annotation (cone / truncatedCone) ───────────────────────────
  const bisX1 = hasSector ? pattern.innerRadius : 0;
  const bisX2 = hasSector ? outerRadius : 0;
  const apexTickD  = `M ${bisX1} ${-tickLen} L ${bisX1} ${tickLen}`;
  const outerTickD = `M ${bisX2} ${-tickLen} L ${bisX2} ${tickLen}`;

  // ─── Base card data ────────────────────────────────────────────────────────

  // For cone shapes: circular cross-sections
  // Use pattern.shape (not state.shape) to avoid debounce-window mismatch
  let baseCircles: { label: string; mm: number }[] = [];
  if (pattern.shape === 'cone') {
    const dMm = toMm(inputs['radius'] ?? '', unit);
    baseCircles = [{ label: 'D', mm: dMm }];
  } else if (pattern.shape === 'truncatedCone' || pattern.shape === 'obliqueFrustum') {
    const dMm    = toMm(inputs['bottomRadius'] ?? '', unit);
    const dTopMm = toMm(inputs['topRadius'] ?? '', unit);
    baseCircles = [
      { label: 'D', mm: dMm },
      { label: 'd', mm: dTopMm },
    ];
  }

  // For box: rectangular cross-sections (bottom and top)
  let baseRects: { label: string; wMm: number; lMm: number }[] = [];
  if (pattern.shape === 'taperedBox') {
    const bW = toMm(inputs['bottomWidth'] ?? '', unit);
    const bL = toMm(inputs['bottomLength'] ?? '', unit);
    const tW = toMm(inputs['topWidth'] ?? '', unit);
    const tL = toMm(inputs['topLength'] ?? '', unit);
    baseRects = [
      { label: 'W×L', wMm: bW, lMm: bL },
      { label: 'w×l', wMm: tW, lMm: tL },
    ];
  }

  if (pattern.shape === 'taperedBox' && nonBasePieces.length >= 4) {
    const front1 = nonBasePieces.find(p => p.id === 'front-1');
    const front2 = nonBasePieces.find(p => p.id === 'front-2');
    const side1  = nonBasePieces.find(p => p.id === 'side-1');
    const side2  = nonBasePieces.find(p => p.id === 'side-2');
    if (!front1 || !front2 || !side1 || !side2) return null;

    const colW0 = front1.boundingBox.width;
    const colW1 = side1.boundingBox.width;
    const rowH  = Math.max(front1.boundingBox.height, side1.boundingBox.height);
    const GGAP  = Math.max(1, Math.max(colW0, colW1, rowH) * 0.15);
    const gridW = colW0 + GGAP + colW1;
    const gridH = rowH * 2 + GGAP;

    // Translate each piece from its original absolute coordinates to its grid cell
    const placements = [
      { piece: front1, tx: -front1.boundingBox.x,                       ty: 0           },
      { piece: side1,  tx: -side1.boundingBox.x  + colW0 + GGAP,        ty: 0           },
      { piece: front2, tx: -front2.boundingBox.x,                       ty: rowH + GGAP },
      { piece: side2,  tx: -side2.boundingBox.x  + colW0 + GGAP,        ty: rowH + GGAP },
    ];

    const gRef    = Math.max(gridW, gridH);
    const gPad    = gRef * PADDING_RATIO;
    const gAnnotFs = gRef * 0.5 * 0.048;

    return (
      <div
        data-cursor="canvas"
        className="flex-1 min-h-0 relative border rounded overflow-hidden"
        style={{ background: '#F4EDE1', borderColor: 'rgba(60,48,38,0.2)' }}
      >
        <svg
          className="absolute inset-0 w-full h-full canvas-breathe"
          viewBox={`${-gPad} ${-gPad} ${gridW + gPad * 2} ${gridH + gPad * 2}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {placements.map(({ piece, tx, ty }) => {
            // Center of piece in its original coordinate space (used for annotation text)
            const cx = piece.boundingBox.x + piece.boundingBox.width  / 2;
            const cy =                       piece.boundingBox.height / 2;
            const isFront = piece.id.startsWith('front');
            const isTopRow = piece.id === 'front-1' || piece.id === 'side-1';
            const faceH    = isFront
              ? pattern.slantHeight
              : (pattern.secondarySlant ?? pattern.slantHeight);
            const faceLabel = isFront ? t('annot.front') : t('annot.side');

            return (
              <g key={piece.id} transform={`translate(${tx}, ${ty})`}>
                <path
                  d={piece.svgPath}
                  fill="#e4dace"
                  fillRule="evenodd"
                  stroke="rgba(60,48,38,0.65)"
                  strokeWidth={0.9}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {isTopRow ? (
                  <>
                    <text
                      x={cx} y={cy - gAnnotFs * 0.35}
                      fill={ANNOT_COLOR} fontSize={gAnnotFs}
                      fontFamily="Didot,'Bodoni MT','Bodoni 72','GFS Didot',serif"
                      fontWeight={400} textAnchor="middle" dominantBaseline="middle"
                    >
                      s {fmt(faceH)}
                    </text>
                    <text
                      x={cx} y={cy + gAnnotFs * 0.75}
                      fill={ANNOT_COLOR} fontSize={gAnnotFs * 0.5}
                      fontFamily="Didot,'Bodoni MT','Bodoni 72','GFS Didot',serif"
                      fontWeight={400} textAnchor="middle" dominantBaseline="middle"
                    >
                      {faceLabel}
                    </text>
                  </>
                ) : (
                  <text
                    x={cx} y={cy}
                    fill={ANNOT_COLOR} fontSize={gAnnotFs * 0.62}
                    fontFamily="Didot,'Bodoni MT','Bodoni 72','GFS Didot',serif"
                    fontWeight={400} textAnchor="middle" dominantBaseline="middle"
                    opacity={0.5}
                  >
                    {faceLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ─── BASE CARD ─── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            background: 'rgba(242,235,226,0.95)',
            border: '1px solid rgba(60,48,38,0.18)',
            borderRadius: 4,
            padding: '8px 12px 10px',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            width: CARD_W,
            textAlign: 'center',
          }}
        >
          <div style={{
            fontFamily: "'Apple Juice', cursive",
            fontSize: 17,
            fontWeight: 400,
            color: 'var(--color-rojo)',
            lineHeight: 1,
            marginBottom: 6,
          }}>
            base
          </div>
          {baseRects.map(({ label, wMm, lMm }, i) => {
            const { w: pxW, l: pxL } = rectPx(wMm, lMm);
            return (
              <div key={label} style={{ marginBottom: i < baseRects.length - 1 ? 8 : 0 }}>
                <div style={{
                  fontFamily: "'Apple Juice', cursive",
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--color-tierra)',
                  marginBottom: 3,
                  letterSpacing: '0.03em',
                }}>
                  {label} {fmt(wMm)} × {fmt(lMm)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <svg width={SHAPE_SVG} height={SHAPE_SVG} viewBox={`0 0 ${SHAPE_SVG} ${SHAPE_SVG}`}>
                    <rect
                      x={(SHAPE_SVG - pxW) / 2} y={(SHAPE_SVG - pxL) / 2}
                      width={pxW} height={pxL}
                      fill="#CCCC73"
                      stroke="rgba(60,48,38,0.18)" strokeWidth={0.8}
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-cursor="canvas"
      className="flex-1 min-h-0 relative border rounded overflow-hidden"
      style={{ background: '#F4EDE1', borderColor: 'rgba(60,48,38,0.2)' }}
    >
      <svg
        className="absolute inset-0 w-full h-full canvas-breathe"
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Main pattern path — base pieces excluded (shown in the base card instead) */}
        <path
          d={displayPath}
          fill="#e4dace"
          fillRule="evenodd"
          stroke="rgba(60,48,38,0.65)"
          strokeWidth={0.9}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Arc-shape annotation: bisector dimension line + slant + sector angle */}
        {hasSector && (
          <>
            <line
              x1={bisX1} y1={0} x2={bisX2} y2={0}
              stroke={ANNOT_COLOR}
              strokeWidth={0.55}
              strokeDasharray={dash}
              vectorEffect="non-scaling-stroke"
            />
            <path d={apexTickD}  stroke={ANNOT_COLOR} strokeWidth={0.55} vectorEffect="non-scaling-stroke" />
            <path d={outerTickD} stroke={ANNOT_COLOR} strokeWidth={0.55} vectorEffect="non-scaling-stroke" />
            {/* slant height — above the bisector */}
            <text
              x={(bisX1 + bisX2) / 2}
              y={-annotFs * 0.85}
              fill={ANNOT_COLOR}
              fontSize={annotFs}
              fontFamily="Didot, 'Bodoni MT', 'Bodoni 72', 'GFS Didot', serif"
              fontWeight={400}
              textAnchor="middle"
            >
              l {fmt(slantHeight)}
            </text>
            {/* sector angle — below the bisector, inside the sector */}
            <text
              x={(bisX1 + bisX2) / 2}
              y={annotFs * 1.5}
              fill={ANNOT_COLOR}
              fontSize={annotFs}
              fontFamily="Didot, 'Bodoni MT', 'Bodoni 72', 'GFS Didot', serif"
              fontWeight={400}
              textAnchor="middle"
            >
              {pattern.arcAngleDeg.toFixed(1)}°
            </text>
          </>
        )}

        {/* ─── Jarra (oblique frustum) annotation — vertical cota + max slant label ─── */}
        {pattern.shape === 'obliqueFrustum' && nonBasePieces[0] && (() => {
          const piece = nonBasePieces[0];
          const cx  = piece.boundingBox.x + piece.boundingBox.width / 2;
          const top = piece.boundingBox.y;
          const bot = piece.boundingBox.y + piece.boundingBox.height;
          const mcy = (top + bot) / 2;
          const topTickD = `M ${cx - tickLen} ${top} L ${cx + tickLen} ${top}`;
          const botTickD = `M ${cx - tickLen} ${bot} L ${cx + tickLen} ${bot}`;
          return (
            <>
              <line
                x1={cx} y1={top} x2={cx} y2={bot}
                stroke={ANNOT_COLOR}
                strokeWidth={0.55}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
              <path d={topTickD} stroke={ANNOT_COLOR} strokeWidth={0.55} vectorEffect="non-scaling-stroke" />
              <path d={botTickD} stroke={ANNOT_COLOR} strokeWidth={0.55} vectorEffect="non-scaling-stroke" />
              <text
                x={cx + annotFs * 0.75}
                y={mcy}
                fill={ANNOT_COLOR}
                fontSize={annotFs}
                fontFamily="Didot, 'Bodoni MT', 'Bodoni 72', 'GFS Didot', serif"
                fontWeight={400}
                textAnchor="start"
                dominantBaseline="middle"
              >
                l {fmt(pattern.slantHeight)}
              </text>
            </>
          );
        })()}

        {/* ─── Caja (tapered box) annotations — one label per face pair, s symbol, face id ─── */}
        {pattern.shape === 'taperedBox' && nonBasePieces
          .filter(p => p.id === 'front-1' || p.id === 'side-1')
          .map(piece => {
            const cx = piece.boundingBox.x + piece.boundingBox.width / 2;
            const cy = piece.boundingBox.y + piece.boundingBox.height / 2;
            const isFront = piece.id === 'front-1';
            const faceH = isFront
              ? pattern.slantHeight
              : (pattern.secondarySlant ?? pattern.slantHeight);
            const faceLabel = isFront ? t('annot.front') : t('annot.side');
            return (
              <g key={piece.id}>
                <text
                  x={cx} y={cy - annotFs * 0.35}
                  fill={ANNOT_COLOR}
                  fontSize={annotFs}
                  fontFamily="Didot, 'Bodoni MT', 'Bodoni 72', 'GFS Didot', serif"
                  fontWeight={400}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  s {fmt(faceH)}
                </text>
                <text
                  x={cx} y={cy + annotFs * 0.75}
                  fill={ANNOT_COLOR}
                  fontSize={annotFs * 0.5}
                  fontFamily="Didot, 'Bodoni MT', 'Bodoni 72', 'GFS Didot', serif"
                  fontWeight={400}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {faceLabel}
                </text>
              </g>
            );
          })}

      </svg>

      {/* ─── BASE CARD — bottom-right ─── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 14,
          right: 14,
          background: 'rgba(242,235,226,0.95)',
          border: '1px solid rgba(60,48,38,0.18)',
          borderRadius: 4,
          padding: '10px 14px 12px',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
          width: CARD_W,
          textAlign: 'center',
        }}
      >
        {/* "base" label */}
        <div style={{
          fontFamily: "'Apple Juice', cursive",
          fontSize: 19,
          fontWeight: 400,
          color: 'var(--color-rojo)',
          lineHeight: 1,
          marginBottom: 8,
          letterSpacing: '0.02em',
        }}>
          base
        </div>

        {/* Circular cross-sections (cone / truncated cone / oblique frustum) */}
        {baseCircles.map(({ label, mm }, i) => (
          <div key={label} style={{ marginBottom: i < baseCircles.length - 1 ? 10 : 0 }}>
            <div style={{
              fontFamily: "'Apple Juice', cursive",
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--color-tierra)',
              marginBottom: 4,
              letterSpacing: '0.03em',
            }}>
              {label} {fmt(mm)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <svg width={SHAPE_SVG} height={SHAPE_SVG} viewBox={`0 0 ${SHAPE_SVG} ${SHAPE_SVG}`}>
                <circle
                  cx={SHAPE_SVG / 2}
                  cy={SHAPE_SVG / 2}
                  r={SHAPE_MAX / 2}
                  fill="#CCCC73"
                  stroke="rgba(60,48,38,0.18)"
                  strokeWidth={0.8}
                />
              </svg>
            </div>
          </div>
        ))}

        {/* Rectangular cross-sections (tapered box) */}
        {baseRects.map(({ label, wMm, lMm }, i) => {
          const { w: pxW, l: pxL } = rectPx(wMm, lMm);
          return (
            <div key={label} style={{ marginBottom: i < baseRects.length - 1 ? 10 : 0 }}>
              <div style={{
                fontFamily: "'Apple Juice', cursive",
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--color-tierra)',
                marginBottom: 4,
                letterSpacing: '0.03em',
              }}>
                {label} {fmt(wMm)} × {fmt(lMm)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <svg width={SHAPE_SVG} height={SHAPE_SVG} viewBox={`0 0 ${SHAPE_SVG} ${SHAPE_SVG}`}>
                  <rect
                    x={(SHAPE_SVG - pxW) / 2}
                    y={(SHAPE_SVG - pxL) / 2}
                    width={pxW}
                    height={pxL}
                    fill="#CCCC73"
                    stroke="rgba(60,48,38,0.18)"
                    strokeWidth={0.8}
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
