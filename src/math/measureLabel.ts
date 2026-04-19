import type { ShapeType } from '../types/geometry';

export function buildMeasureLabel(
  shape: ShapeType,
  inputs: Record<string, string>,
  unit: string
): string {
  const v = (k: string) => inputs[k] ?? '?';

  if (shape === 'cone') {
    return `D ${v('radius')}  H ${v('height')} ${unit}`;
  } else if (shape === 'truncatedCone' || shape === 'obliqueFrustum') {
    return `D ${v('bottomRadius')}  d ${v('topRadius')}  H ${v('height')} ${unit}`;
  } else {
    return `W ${v('bottomWidth')}  L ${v('bottomLength')}  w ${v('topWidth')}  l ${v('topLength')}  H ${v('height')} ${unit}`;
  }
}
