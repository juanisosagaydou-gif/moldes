import type { PatternResult } from '../types/geometry';
import { downloadFile } from './downloadFile';

export function exportSvg(patterns: PatternResult[]) {
  if (patterns.length === 0) return;
  const padding = 10;
  const gap = 20; // mm between patterns

  if (patterns.length === 1) {
    const pattern = patterns[0];
    const bb = pattern.boundingBox;
    const annotElems = (pattern.textAnnotations ?? [])
      .map(a => `  <text x="${a.x}" y="${a.y}" text-anchor="middle" font-size="${a.fontSize}" font-family="'Apple Juice', cursive" fill="rgba(60,48,38,0.45)">${a.text}</text>`)
      .join('\n');

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
  width="${bb.width + 2 * padding}mm"
  height="${bb.height + 2 * padding}mm"
  viewBox="${bb.x - padding} ${bb.y - padding} ${bb.width + 2 * padding} ${bb.height + 2 * padding}">
  <path d="${pattern.svgPath}" fill="none" stroke="#000000" stroke-width="0.3"/>
${annotElems}
</svg>`;
    downloadFile(svgContent, 'moldes-pattern.svg', 'image/svg+xml');
    return;
  }

  // Multiple patterns: stack vertically in one SVG
  const totalWidth = Math.max(...patterns.map(p => p.boundingBox.width)) + 2 * padding;
  const totalHeight = patterns.reduce((sum, p) => sum + p.boundingBox.height, 0)
    + 2 * padding + gap * (patterns.length - 1);

  let yOffset = padding;
  const children: string[] = [];

  for (const pattern of patterns) {
    const bb = pattern.boundingBox;
    const tx = padding - bb.x;
    const ty = yOffset - bb.y;

    const annotElems = (pattern.textAnnotations ?? [])
      .map(a => `    <text x="${a.x + tx}" y="${a.y + ty}" text-anchor="middle" font-size="${a.fontSize}" font-family="'Apple Juice', cursive" fill="rgba(60,48,38,0.45)">${a.text}</text>`)
      .join('\n');

    children.push(`  <g transform="translate(${tx}, ${ty})">
    <path d="${pattern.svgPath}" fill="none" stroke="#000000" stroke-width="0.3"/>
${annotElems}  </g>`);

    yOffset += bb.height + gap;
  }

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
  width="${totalWidth}mm"
  height="${totalHeight}mm"
  viewBox="0 0 ${totalWidth} ${totalHeight}">
${children.join('\n')}
</svg>`;

  downloadFile(svgContent, 'moldes-pattern.svg', 'image/svg+xml');
}
