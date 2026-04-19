import { useTranslation } from '../i18n/useTranslation';
import type { PatternResult } from '../types/geometry';
import type { PackedLayout } from '../types/print';
import { PrintPreviewPage } from './PrintPreviewPage';
import { useAppState, useActiveItem } from '../state/appContext';
import { buildMeasureLabel } from '../math/measureLabel';

interface PrintPreviewProps {
  pattern: PatternResult | null;
  layout: PackedLayout | null;
}

export function PrintPreview({ pattern, layout }: PrintPreviewProps) {
  const { t } = useTranslation();
  const { state } = useAppState();
  const activeItem = useActiveItem();
  const measureLabel = buildMeasureLabel(activeItem.shape, activeItem.inputs, state.unit);

  if (!pattern || !layout) return null;

  return (
    <div>
      <div className="flex items-center justify-center" style={{ height: 22, paddingLeft: 22 }}>
        <h3 className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: '#F4EDE1' }}>
          {t('preview.printPreview')}
        </h3>
      </div>
      <div className="flex flex-col gap-3" style={{ marginTop: 28, alignItems: 'center' }}>
        {layout.pages.map((page, i) => (
          <PrintPreviewPage
            key={i}
            page={page}
            layout={layout}
            pageIndex={i}
            measureLabel={measureLabel}
            unit={state.unit}
          />
        ))}
      </div>
    </div>
  );
}
