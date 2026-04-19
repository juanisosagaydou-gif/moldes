import type { AppState, StackItem } from '../types/app';

export const SHAPE_DEFAULTS: Record<string, Record<string, string>> = {
  cone: { radius: '5', height: '6' },
  truncatedCone: { bottomRadius: '15', topRadius: '10', height: '20' },
  obliqueFrustum: { bottomRadius: '15', topRadius: '10', height: '20' },
  taperedBox: { bottomWidth: '10', bottomLength: '7', topWidth: '7', topLength: '6', height: '6' },
};

const DEFAULT_ITEM: StackItem = {
  id: 'default',
  shape: 'cone',
  inputs: { ...SHAPE_DEFAULTS.cone },
};

export const DEFAULT_STATE: AppState = {
  stack: [DEFAULT_ITEM],
  activeStackId: 'default',
  unit: 'cm',
  language: navigator.language.startsWith('en') ? 'en' : 'es',
  pageSize: 'A4',
  orientation: 'portrait',
  margins: 10,
};
