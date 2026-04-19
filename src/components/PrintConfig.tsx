import { useState } from 'react';
import { useAppState } from '../state/appContext';
import { useTranslation } from '../i18n/useTranslation';
import type { PageSize, Orientation, PackedLayout } from '../types/print';

interface PrintConfigProps {
  layout: PackedLayout | null;
}

const DIDOT = "'Didot', 'GFS Didot', 'Bodoni MT', 'Playfair Display', serif";
const APPLE_JUICE = "'Apple Juice', cursive";

export function PrintConfig({ layout }: PrintConfigProps) {
  const { state, dispatch } = useAppState();
  const { t } = useTranslation();
  const [marginFocused, setMarginFocused] = useState(false);

  const btnBase = 'flex-1 h-[46px] text-sm font-bold';

  return (
    <div className="flex flex-col gap-2">

      {/* Page size */}
      <div className="flex gap-2">
        {(['A4', 'A3'] as PageSize[]).map(size => (
          <button
            key={size}
            className={`${btnBase} ${state.pageSize === size ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => dispatch({ type: 'SET_PAGE_SIZE', payload: size })}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Orientation */}
      <div className="flex gap-2">
        {(['portrait', 'landscape'] as Orientation[]).map(o => (
          <button
            key={o}
            className={`${btnBase} ${state.orientation === o ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => dispatch({ type: 'SET_ORIENTATION', payload: o })}
          >
            {t(`print.${o}`)}
          </button>
        ))}
      </div>

      {/* Margins + Page count — editorial underline treatment */}
      <div className="flex gap-4 mt-2 px-1">

        {/* Margins */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <input
            type="text"
            inputMode="decimal"
            value={state.margins}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) dispatch({ type: 'SET_MARGINS', payload: v });
            }}
            onFocus={() => setMarginFocused(true)}
            onBlur={() => setMarginFocused(false)}
            style={{
              width: '100%',
              fontFamily: DIDOT,
              fontSize: 22,
              fontWeight: 400,
              background: 'transparent',
              border: 'none',
              borderBottom: `1.5px solid ${marginFocused ? 'var(--color-tierra)' : 'rgba(60,48,38,0.2)'}`,
              borderRadius: 0,
              color: 'var(--color-tierra)',
              textAlign: 'center',
              padding: '0 4px',
              height: 40,
              outline: 'none',
              transition: 'border-color 200ms ease',
            }}
          />
          <span style={{ fontFamily: APPLE_JUICE, fontSize: 11, color: 'rgba(60,48,38,0.55)', lineHeight: 1 }}>
            {t('print.margins')} mm
          </span>
        </div>

        {/* Page count */}
        {layout ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: '100%',
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1.5px solid rgba(60,48,38,0.12)',
            }}>
              <span style={{
                fontFamily: DIDOT,
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--color-tierra)',
                lineHeight: 1,
              }}>
                {layout.totalPages}
              </span>
            </div>
            <span style={{ fontFamily: APPLE_JUICE, fontSize: 11, color: 'rgba(60,48,38,0.55)', lineHeight: 1 }}>
              {t('print.pageCount')}
            </span>
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

      </div>

    </div>
  );
}
