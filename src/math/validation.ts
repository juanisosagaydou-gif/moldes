import type { ShapeType } from '../types/geometry';

export interface ValidationError {
  field: string;
  messageKey: string;
}

export function validateInputs(
  shape: ShapeType,
  inputs: Record<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (shape === 'cone') {
    validatePositiveNumber(inputs.radius, 'radius', errors);
    validatePositiveNumber(inputs.height, 'height', errors);
  } else if (shape === 'truncatedCone' || shape === 'obliqueFrustum') {
    validatePositiveNumber(inputs.bottomRadius, 'bottomRadius', errors);
    validatePositiveNumber(inputs.topRadius, 'topRadius', errors);
    validatePositiveNumber(inputs.height, 'height', errors);

    // Check equal radii (cylinder — not supported)
    const br = parseFloat(inputs.bottomRadius);
    const tr = parseFloat(inputs.topRadius);
    if (!isNaN(br) && !isNaN(tr) && br > 0 && tr > 0 && br === tr) {
      errors.push({ field: 'topRadius', messageKey: 'error.equalRadii' });
    }
  } else if (shape === 'taperedBox') {
    validatePositiveNumber(inputs.bottomWidth, 'bottomWidth', errors);
    validatePositiveNumber(inputs.bottomLength, 'bottomLength', errors);
    validatePositiveNumber(inputs.topWidth, 'topWidth', errors);
    validatePositiveNumber(inputs.topLength, 'topLength', errors);
    validatePositiveNumber(inputs.height, 'height', errors);

    // At least one dimension must differ (otherwise it's a rectangular prism)
    const bw = parseFloat(inputs.bottomWidth);
    const bl = parseFloat(inputs.bottomLength);
    const tw = parseFloat(inputs.topWidth);
    const tl = parseFloat(inputs.topLength);
    if (
      !isNaN(bw) && !isNaN(bl) && !isNaN(tw) && !isNaN(tl) &&
      bw > 0 && bl > 0 && tw > 0 && tl > 0 &&
      bw === tw && bl === tl
    ) {
      errors.push({ field: 'topWidth', messageKey: 'error.equalDimensions' });
    }
  }

  return errors;
}

function validatePositiveNumber(
  value: string | undefined,
  field: string,
  errors: ValidationError[]
): void {
  if (value === undefined || value.trim() === '') {
    errors.push({ field, messageKey: 'error.required' });
    return;
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    errors.push({ field, messageKey: 'error.numeric' });
    return;
  }

  if (num <= 0) {
    errors.push({ field, messageKey: 'error.positive' });
  }
}

export function parseInputs(
  shape: ShapeType,
  inputs: Record<string, string>,
  unit: 'mm' | 'cm'
): Record<string, number> | null {
  const errors = validateInputs(shape, inputs);
  if (errors.length > 0) return null;

  const factor = unit === 'cm' ? 10 : 1;
  const result: Record<string, number> = {};

  let keys: string[];
  if (shape === 'cone') {
    keys = ['radius', 'height'];
  } else if (shape === 'truncatedCone' || shape === 'obliqueFrustum') {
    keys = ['bottomRadius', 'topRadius', 'height'];
  } else {
    // taperedBox
    keys = ['bottomWidth', 'bottomLength', 'topWidth', 'topLength', 'height'];
  }

  // These input fields show diameters; math uses radii — divide by 2
  const radiusKeys = new Set(['radius', 'bottomRadius', 'topRadius']);

  for (const key of keys) {
    const raw = parseFloat(inputs[key]) * factor;
    result[key] = radiusKeys.has(key) ? raw / 2 : raw;
  }

  return result;
}
