import React from 'react';
import { useAppState, useActiveItem } from '../state/appContext';
import { useTranslation } from '../i18n/useTranslation';
import type { ShapeType } from '../types/geometry';


const ConeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10">
    <path d="M12 3 L22 21 H2 Z" fill="currentColor" />
  </svg>
);

const TruncatedConeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10">
    <path d="M7 6 H17 L22 21 H2 Z" fill="currentColor" />
  </svg>
);

const ObliqueFrustumIcon = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10">
    <path d="M5 3 L5 21 L21 21 L17 3 Z" fill="currentColor" />
  </svg>
);

const TaperedBoxIcon = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10">
    <path d="M3 8 L15 8 L18 5 L6 5 Z" fill="currentColor" opacity={0.45} />
    <path d="M15 8 L18 5 L22 20 L19 22 Z" fill="currentColor" opacity={0.68} />
    <path d="M3 8 L15 8 L19 22 L1 22 Z" fill="currentColor" />
  </svg>
);

const icons: Record<ShapeType, () => React.ReactElement> = {
  cone: ConeIcon,
  truncatedCone: TruncatedConeIcon,
  obliqueFrustum: ObliqueFrustumIcon,
  taperedBox: TaperedBoxIcon,
};

export function ShapeButtons() {
  const { dispatch } = useAppState();
  const activeItem = useActiveItem();
  const { t } = useTranslation();

  const shapes: { value: ShapeType; label: string }[] = [
    { value: 'cone',           label: t('shape.cone') },
    { value: 'truncatedCone',  label: t('shape.truncatedCone') },
    { value: 'obliqueFrustum', label: t('shape.obliqueFrustum') },
    { value: 'taperedBox',     label: t('shape.taperedBox') },
  ];

  return (
    <div className="flex" style={{ gap: '1px', alignItems: 'flex-end' }}>
      {shapes.map(s => {
        const Icon = icons[s.value];
        const isActive = activeItem.shape === s.value;
        return (
          <button
            key={s.value}
            aria-label={s.label}
            className={`flex-1 h-[80px] flex items-center justify-center ${isActive ? 'btn-shape-active' : 'btn-shape-inactive'}`}
            onClick={() => dispatch({ type: 'SET_SHAPE', payload: s.value })}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

export function UnitSelector() {
  const { state, dispatch } = useAppState();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        display: 'inline-flex',
        background: 'rgba(60,48,38,0.10)',
        borderRadius: '20px',
        padding: '2px',
      }}>
        {(['cm', 'mm'] as const).map(unit => (
          <button
            key={unit}
            onClick={() => dispatch({ type: 'SET_UNIT', payload: unit })}
            style={{
              width: '56px',
              height: '26px',
              fontSize: '11px',
              fontWeight: state.unit === unit ? 600 : 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: state.unit === unit ? 'var(--color-lino)' : 'transparent',
              color: state.unit === unit ? 'var(--color-tierra)' : 'rgba(60,48,38,0.45)',
              border: 'none',
              borderRadius: '18px',
              cursor: 'pointer',
              transition: 'background 200ms ease, color 180ms ease',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {unit}
          </button>
        ))}
      </div>
    </div>
  );
}
