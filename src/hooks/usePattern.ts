import { useMemo } from 'react';
import type { PatternResult } from '../types/geometry';
import type { PackedLayout } from '../types/print';
import { useAppState, useActiveItem } from '../state/appContext';
import { useDebounce } from './useDebounce';
import { computeCone } from '../math/cone';
import { computeTruncatedCone } from '../math/truncatedCone';
import { computeObliqueFrustum } from '../math/obliqueFrustum';
import { computeTaperedBox } from '../math/taperedBox';
import { computePackedLayout } from '../math/tiling';
import { validateInputs, parseInputs } from '../math/validation';
import type { ValidationError } from '../math/validation';
import type { StackItem } from '../types/app';

interface UsePatternResult {
  pattern: PatternResult | null;    // active item — for PatternCanvas + InfoPanel
  allPatterns: PatternResult[];     // all stack items — for export
  layout: PackedLayout | null;      // combined layout of all patterns
  errors: ValidationError[];
}

function computePatternForItem(item: StackItem, unit: string): PatternResult | null {
  const parsed = parseInputs(item.shape, item.inputs, unit as 'mm' | 'cm');
  if (!parsed) return null;

  const p = parsed as Record<string, number>;

  if (item.shape === 'cone') {
    return computeCone({ radius: p.radius, height: p.height });
  } else if (item.shape === 'truncatedCone') {
    return computeTruncatedCone({ bottomRadius: p.bottomRadius, topRadius: p.topRadius, height: p.height });
  } else if (item.shape === 'obliqueFrustum') {
    return computeObliqueFrustum({ bottomRadius: p.bottomRadius, topRadius: p.topRadius, height: p.height });
  } else {
    return computeTaperedBox({
      bottomWidth: p.bottomWidth, bottomLength: p.bottomLength,
      topWidth: p.topWidth, topLength: p.topLength,
      height: p.height,
    });
  }
}

export function usePattern(): UsePatternResult {
  const { state } = useAppState();
  const activeItem = useActiveItem();
  const debouncedStack = useDebounce(state.stack, 300);
  const debouncedUnit = useDebounce(state.unit, 300);

  // Errors for active item only (shown in InputPanel)
  const debouncedActiveShape = useDebounce(activeItem.shape, 300);
  const debouncedActiveInputs = useDebounce(activeItem.inputs, 300);
  const errors = useMemo(
    () => validateInputs(debouncedActiveShape, debouncedActiveInputs),
    [debouncedActiveShape, debouncedActiveInputs]
  );

  // Patterns for all stack items
  const allPatterns = useMemo(
    () => debouncedStack
      .map(item => computePatternForItem(item, debouncedUnit))
      .filter((p): p is PatternResult => p !== null),
    [debouncedStack, debouncedUnit]
  );

  // Active pattern (for PatternCanvas display)
  const pattern = useMemo(() => {
    const activeIdx = debouncedStack.findIndex(item => item.id === state.activeStackId);
    return allPatterns[activeIdx] ?? allPatterns[0] ?? null;
  }, [allPatterns, debouncedStack, state.activeStackId]);

  // Combined layout — all patterns packed together
  const layout = useMemo(() => {
    if (allPatterns.length === 0) return null;
    const config = { pageSize: state.pageSize, orientation: state.orientation, margins: state.margins };

    if (allPatterns.length === 1) {
      return computePackedLayout(allPatterns[0], config);
    }

    const layouts = allPatterns.map(p => computePackedLayout(p, config));
    const base = layouts[0];
    const combinedPages = layouts.flatMap(l => l.pages);

    return {
      ...base,
      pages: combinedPages,
      totalPages: combinedPages.length,
    };
  }, [allPatterns, state.pageSize, state.orientation, state.margins]);

  return { pattern, allPatterns, layout, errors };
}
