import { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { exportSvg } from '../export/exportSvg';
import { exportPdf } from '../export/exportPdf';
import type { PatternResult } from '../types/geometry';
import type { PackedLayout } from '../types/print';
import { useAppState, useActiveItem } from '../state/appContext';
import { buildMeasureLabel } from '../math/measureLabel';

interface ExportButtonsProps {
  pattern: PatternResult | null;
  allPatterns: PatternResult[];
  layout: PackedLayout | null;
}

export function ExportButtons({ pattern, allPatterns, layout }: ExportButtonsProps) {
  const { t } = useTranslation();
  const { state } = useAppState();
  const activeItem = useActiveItem();
  const [exporting, setExporting] = useState(false);
  const measureLabel = buildMeasureLabel(activeItem.shape, activeItem.inputs, state.unit);

  const disabled = !pattern || !layout;

  const handleExportSvg = () => {
    if (allPatterns.length === 0) return;
    exportSvg(allPatterns);
  };

  const handleExportPdf = async () => {
    if (!layout) return;
    setExporting(true);
    try {
      await exportPdf(layout, measureLabel);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportSvg}
        disabled={disabled}
        className="flex-1 h-[46px] text-sm font-bold btn-secondary btn-export-secondary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t('export.svg')}
      </button>
      <button
        onClick={handleExportPdf}
        disabled={disabled || exporting}
        className="flex-1 h-[46px] text-sm font-bold btn-primary btn-export-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {exporting ? '...' : t('export.pdf')}
      </button>
    </div>
  );
}
