import type { AppState, AppAction, StackItem } from '../types/app';
import type { ShapeType } from '../types/geometry';
import { SHAPE_DEFAULTS } from './defaults';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SHAPE':
      return {
        ...state,
        stack: state.stack.map(item =>
          item.id === state.activeStackId
            ? { ...item, shape: action.payload, inputs: { ...SHAPE_DEFAULTS[action.payload] } }
            : item
        ),
      };

    case 'SET_INPUT':
      return {
        ...state,
        stack: state.stack.map(item =>
          item.id === state.activeStackId
            ? { ...item, inputs: { ...item.inputs, [action.payload.key]: action.payload.value } }
            : item
        ),
      };

    case 'SET_UNIT':
      return { ...state, unit: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload };
    case 'SET_ORIENTATION':
      return { ...state, orientation: action.payload };
    case 'SET_MARGINS':
      return { ...state, margins: action.payload };

    case 'ADD_STACK_ITEM': {
      const totalMm = state.stack.reduce((sum, item) => {
        const h = parseFloat(item.inputs.height ?? '0') || 0;
        return sum + (state.unit === 'cm' ? h * 10 : h);
      }, 0);
      if (totalMm >= 500) return state;

      const lastItem = state.stack[state.stack.length - 1];
      const isLastRadial =
        lastItem.shape === 'truncatedCone' || lastItem.shape === 'obliqueFrustum';

      const newShape: ShapeType = 'truncatedCone';
      const newInputs: Record<string, string> = { ...SHAPE_DEFAULTS[newShape] };

      if (isLastRadial && lastItem.inputs.topRadius) {
        newInputs.bottomRadius = lastItem.inputs.topRadius;
      }

      const newItem: StackItem = {
        id: Math.random().toString(36).slice(2, 9),
        shape: newShape,
        inputs: newInputs,
      };

      return {
        ...state,
        stack: [...state.stack, newItem],
        activeStackId: newItem.id,
      };
    }

    case 'REMOVE_STACK_ITEM': {
      if (state.stack.length <= 1) return state;
      const idx = state.stack.findIndex(item => item.id === action.payload);
      if (idx === -1) return state;
      const newStack = state.stack.filter(item => item.id !== action.payload);
      const newActiveId =
        state.activeStackId === action.payload
          ? newStack[Math.max(0, idx - 1)].id
          : state.activeStackId;
      return { ...state, stack: newStack, activeStackId: newActiveId };
    }

    case 'SET_ACTIVE_STACK_ITEM':
      return { ...state, activeStackId: action.payload };

    case 'REORDER_STACK_ITEM': {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return state;
      const newStack = [...state.stack];
      const [moved] = newStack.splice(fromIndex, 1);
      newStack.splice(toIndex, 0, moved);
      return { ...state, stack: newStack };
    }

    default:
      return state;
  }
}
