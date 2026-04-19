import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { TextAnnotation } from '../types/geometry';
import type { PackedLayout, PackedPage, PlacedPiece, TiledPieceOnPage } from '../types/print';
import { OVERLAP } from '../types/print';
import { downloadFile } from './downloadFile';

const APPLE = `'Apple Juice', cursive`;

async function imageToDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** SVG transform attribute for a placed piece */
function placedTransform(p: PlacedPiece): string {
  if (p.rotation === 0) {
    return `translate(${p.pageX - p.bboxX}, ${p.pageY - p.bboxY})`;
  }
  return `translate(${p.pageX}, ${p.pageY + p.bboxWidth}) rotate(90) translate(${-p.bboxX}, ${-p.bboxY})`;
}

function annotStr(annotations: TextAnnotation[] | undefined): string {
  if (!annotations?.length) return '';
  return annotations
    .map(a => `<text x="${a.x}" y="${a.y}" text-anchor="middle" font-size="${a.fontSize}" font-family="${APPLE}" fill="rgba(60,48,38,0.45)">${a.text}</text>`)
    .join('\n        ');
}

export async function exportPdf(layout: PackedLayout, measureLabel = '') {
  const { pageWidth, pageHeight } = layout;

  // Pre-fetch assembly icons AND font as data URIs so svg2pdf can embed them reliably
  const [spiralUri, scissorsUri, fontUri] = await Promise.all([
    imageToDataUri('/png%20ensamblado/IMG_0685.PNG'),
    imageToDataUri('/png%20ensamblado/IMG_0686.PNG'),
    imageToDataUri('/fonts/Apple%20Juice%20Regular.ttf'),
  ]);

  const doc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  for (let i = 0; i < layout.pages.length; i++) {
    if (i > 0) doc.addPage([pageWidth, pageHeight]);

    const page = layout.pages[i];
    const svgString = buildPageSvg(
      page, layout, i, measureLabel, spiralUri, scissorsUri, fontUri,
    );

    const container = document.createElement('div');
    container.innerHTML = svgString;
    const svgElement = container.querySelector('svg')!;
    document.body.appendChild(container);
    container.style.position = 'absolute';
    container.style.left = '-9999px';

    try {
      await svg2pdf(svgElement, doc, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    } finally {
      document.body.removeChild(container);
    }
  }

  const pdfBlob = doc.output('blob');
  downloadFile(pdfBlob, 'moldes-pattern.pdf', 'application/pdf');
}

function buildPageSvg(
  page: PackedPage,
  layout: PackedLayout,
  index: number,
  measureLabel: string,
  spiralUri: string,
  scissorsUri: string,
  fontUri: string,
): string {
  const { pageWidth: pw, pageHeight: ph, margins: m, printableWidth: printW, printableHeight: printH } = layout;
  const clipId = `pdf-clip-${index}`;
  const tiled = page.tiled as TiledPieceOnPage | undefined;

  // ── Crop marks ──
  const cropLen = 5;
  let cropMarks = '';
  const addCrop = (x1: number, y1: number, x2: number, y2: number) => {
    cropMarks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="0.3"/>`;
  };
  addCrop(m - cropLen, m, m, m);
  addCrop(m, m - cropLen, m, m);
  addCrop(m + printW, m, m + printW + cropLen, m);
  addCrop(m + printW, m - cropLen, m + printW, m);
  addCrop(m - cropLen, m + printH, m, m + printH);
  addCrop(m, m + printH, m, m + printH + cropLen);
  addCrop(m + printW, m + printH, m + printW + cropLen, m + printH);
  addCrop(m + printW, m + printH, m + printW, m + printH + cropLen);

  // ── Tiled content ──
  let tiledSvg = '';
  if (tiled) {
    tiledSvg = `
  <defs>
    <clipPath id="${clipId}">
      <rect x="${m}" y="${m}" width="${printW}" height="${printH}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#${clipId})">
    <g transform="translate(${tiled.tx}, ${tiled.ty})">
      <g transform="rotate(${tiled.rotationAngle})">
        <path d="${tiled.svgPath}" fill="none" stroke="#000000" stroke-width="0.3"/>
        ${annotStr(tiled.textAnnotations)}
      </g>
    </g>
  </g>`;
  }

  // ── Placed pieces ──
  const placedSvg = page.placed
    .map(p => `
  <g transform="${placedTransform(p)}">
    <path d="${p.svgPath}" fill="none" stroke="#000000" stroke-width="0.3"/>
    ${annotStr(p.textAnnotations)}
  </g>`)
    .join('');

  // ── Overlap indicators (only for tiled pages) ──
  const FS = 4.2;
  const midY = m + printH / 2;
  const midX = m + printW / 2;
  const leftX = m + OVERLAP;
  const topY  = m + OVERLAP;
  // "pegar" line sits at the physical edge — matches the cut edge of the next sheet
  const rightX = m + printW;
  const botY   = m + printH;

  const RED     = '#DF362A';
  const CELESTE = '#5AACCF';

  const IH = 7;
  const IW = 7;
  const IGAP = 2.5;
  const CORTAR_HW = 9;
  const PEGAR_HW  = 28;

  // Half-width of the full label zone — used to split the dashed line
  const CORTAR_GAP = CORTAR_HW + IGAP + IW + 3;
  const PEGAR_GAP  = PEGAR_HW  + IGAP + IW + 3;

  // Flips icon horizontally around its own bounding box
  const mirrorX = (rx: number) => `translate(${2 * rx + IW}, 0) scale(-1, 1)`;

  let overlapLines = '';
  if (tiled) {
    if (tiled.hasLeftNeighbor) {
      // Line split into two segments — gap where the label sits
      overlapLines += `<rect x="${m}" y="${m}" width="${OVERLAP}" height="${printH}" fill="rgba(223,54,42,0.07)"/>`;
      overlapLines += `<line x1="${leftX}" y1="${m}" x2="${leftX}" y2="${midY - CORTAR_GAP}" stroke="${RED}" stroke-width="0.35" stroke-opacity="0.6" stroke-dasharray="3 2"/>`;
      overlapLines += `<line x1="${leftX}" y1="${midY + CORTAR_GAP}" x2="${leftX}" y2="${m + printH}" stroke="${RED}" stroke-width="0.35" stroke-opacity="0.6" stroke-dasharray="3 2"/>`;
      // Label centered ON the line
      overlapLines += `<g transform="rotate(-90, ${leftX}, ${midY})">`;
      overlapLines += `<image href="${scissorsUri}" x="${leftX - CORTAR_HW - IGAP - IW}" y="${midY - IH / 2}" width="${IW}" height="${IH}"/>`;
      overlapLines += `<text x="${leftX}" y="${midY + FS * 0.38}" text-anchor="middle" font-size="${FS}" font-family="${APPLE}" fill="${RED}" fill-opacity="0.85">cortar acá</text>`;
      overlapLines += `<image href="${scissorsUri}" x="${leftX + CORTAR_HW + IGAP}" y="${midY - IH / 2}" width="${IW}" height="${IH}" transform="${mirrorX(leftX + CORTAR_HW + IGAP)}"/>`;
      overlapLines += `</g>`;
    }
    if (tiled.hasRightNeighbor) {
      overlapLines += `<line x1="${rightX}" y1="${m}" x2="${rightX}" y2="${midY - PEGAR_GAP}" stroke="${CELESTE}" stroke-width="0.35" stroke-opacity="0.5" stroke-dasharray="3 2"/>`;
      overlapLines += `<line x1="${rightX}" y1="${midY + PEGAR_GAP}" x2="${rightX}" y2="${m + printH}" stroke="${CELESTE}" stroke-width="0.35" stroke-opacity="0.5" stroke-dasharray="3 2"/>`;
      overlapLines += `<g transform="rotate(-90, ${rightX}, ${midY})">`;
      overlapLines += `<image href="${spiralUri}" x="${rightX - PEGAR_HW - IGAP - IW}" y="${midY - IH / 2}" width="${IW}" height="${IH}"/>`;
      overlapLines += `<text x="${rightX}" y="${midY + FS * 0.38}" text-anchor="middle" font-size="${FS}" font-family="${APPLE}" fill="${CELESTE}" fill-opacity="0.85">pegar sobre la línea punteada</text>`;
      overlapLines += `<image href="${spiralUri}" x="${rightX + PEGAR_HW + IGAP}" y="${midY - IH / 2}" width="${IW}" height="${IH}" transform="${mirrorX(rightX + PEGAR_HW + IGAP)}"/>`;
      overlapLines += `</g>`;
    }
    if (tiled.hasTopNeighbor) {
      overlapLines += `<rect x="${m}" y="${m}" width="${printW}" height="${OVERLAP}" fill="rgba(223,54,42,0.07)"/>`;
      overlapLines += `<line x1="${m}" y1="${topY}" x2="${midX - CORTAR_GAP}" y2="${topY}" stroke="${RED}" stroke-width="0.35" stroke-opacity="0.6" stroke-dasharray="3 2"/>`;
      overlapLines += `<line x1="${midX + CORTAR_GAP}" y1="${topY}" x2="${m + printW}" y2="${topY}" stroke="${RED}" stroke-width="0.35" stroke-opacity="0.6" stroke-dasharray="3 2"/>`;
      overlapLines += `<image href="${scissorsUri}" x="${midX - CORTAR_HW - IGAP - IW}" y="${topY - IH / 2}" width="${IW}" height="${IH}"/>`;
      overlapLines += `<text x="${midX}" y="${topY + FS * 0.38}" text-anchor="middle" font-size="${FS}" font-family="${APPLE}" fill="${RED}" fill-opacity="0.85">cortar acá</text>`;
      overlapLines += `<image href="${scissorsUri}" x="${midX + CORTAR_HW + IGAP}" y="${topY - IH / 2}" width="${IW}" height="${IH}" transform="${mirrorX(midX + CORTAR_HW + IGAP)}"/>`;
    }
    if (tiled.hasBottomNeighbor) {
      overlapLines += `<line x1="${m}" y1="${botY}" x2="${midX - PEGAR_GAP}" y2="${botY}" stroke="${CELESTE}" stroke-width="0.35" stroke-opacity="0.5" stroke-dasharray="3 2"/>`;
      overlapLines += `<line x1="${midX + PEGAR_GAP}" y1="${botY}" x2="${m + printW}" y2="${botY}" stroke="${CELESTE}" stroke-width="0.35" stroke-opacity="0.5" stroke-dasharray="3 2"/>`;
      overlapLines += `<image href="${spiralUri}" x="${midX - PEGAR_HW - IGAP - IW}" y="${botY - IH / 2}" width="${IW}" height="${IH}"/>`;
      overlapLines += `<text x="${midX}" y="${botY + FS * 0.38}" text-anchor="middle" font-size="${FS}" font-family="${APPLE}" fill="${CELESTE}" fill-opacity="0.75">pegar sobre la línea punteada</text>`;
      overlapLines += `<image href="${spiralUri}" x="${midX + PEGAR_HW + IGAP}" y="${botY - IH / 2}" width="${IW}" height="${IH}" transform="${mirrorX(midX + PEGAR_HW + IGAP)}"/>`;
    }
  }

  const pageLabel = layout.totalPages > 1
    ? (tiled ? `${String.fromCharCode(65 + tiled.row)}${tiled.col + 1}  ${index + 1}/${layout.totalPages}` : `${index + 1}/${layout.totalPages}`)
    : String(index + 1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}">
  <defs>
    <style>@font-face { font-family: 'Apple Juice'; src: url('${fontUri}') format('truetype'); }</style>
  </defs>
  <rect width="${pw}" height="${ph}" fill="white"/>
  ${tiledSvg}
  ${placedSvg}
  ${cropMarks}
  ${overlapLines}
  <text x="${pw - 2}" y="${ph - 2}" text-anchor="end" font-size="4.5" fill="#555" font-family="sans-serif">${pageLabel}</text>
  <text x="2" y="${ph - 2}" text-anchor="start" font-size="4" fill="#888" font-family="sans-serif">${measureLabel}</text>
</svg>`;
}
