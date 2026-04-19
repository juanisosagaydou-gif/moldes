import type { ShapeType } from './geometry';
import type { PageSize, Orientation } from './print';

export type Unit = 'mm' | 'cm';
export type Language = 'es' | 'en';

export interface StackItem {
  id: string;
  shape: ShapeType;
  inputs: Record<string, string>;
}

export interface AppState {
  stack: StackItem[];
  activeStackId: string;
  unit: Unit;
  language: Language;
  pageSize: PageSize;
  orientation: Orientation;
  margins: number; // always in mm
}

export type AppAction =
  | { type: 'SET_SHAPE'; payload: ShapeType }
  | { type: 'SET_INPUT'; payload: { key: string; value: string } }
  | { type: 'SET_UNIT'; payload: Unit }
  | { type: 'SET_LANGUAGE'; payload: Language }
  | { type: 'SET_PAGE_SIZE'; payload: PageSize }
  | { type: 'SET_ORIENTATION'; payload: Orientation }
  | { type: 'SET_MARGINS'; payload: number }
  | { type: 'ADD_STACK_ITEM' }
  | { type: 'REMOVE_STACK_ITEM'; payload: string }
  | { type: 'SET_ACTIVE_STACK_ITEM'; payload: string }
  | { type: 'REORDER_STACK_ITEM'; payload: { fromIndex: number; toIndex: number } };
