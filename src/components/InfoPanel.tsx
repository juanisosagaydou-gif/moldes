import React, { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { useAppState } from '../state/appContext';
import type { PatternResult } from '../types/geometry';

interface InfoPanelProps {
  pattern: PatternResult | null;
}

const DIDOT = "'Didot', 'GFS Didot', 'Bodoni MT', 'Playfair Display', serif";
const APPLE_JUICE = "'Apple Juice', cursive";

const titleStyle: React.CSSProperties = {
  fontFamily: DIDOT,
  fontSize: 17,
  fontWeight: 400,
  lineHeight: 1.1,
  textTransform: 'lowercase',
};

export function InfoPanel({ pattern }: InfoPanelProps) {
  const { t } = useTranslation();
  const { state } = useAppState();
  const [open, setOpen] = useState(false);

  const totalMm = state.stack.reduce((sum, item) => {
    const h = parseFloat(item.inputs.height ?? '0') || 0;
    return sum + (state.unit === 'cm' ? h * 10 : h);
  }, 0);
  const totalDisplay = state.unit === 'cm'
    ? `${(totalMm / 10).toFixed(1).replace(/\.0$/, '')} cm`
    : `${Math.round(totalMm)} mm`;
  const showTotal = state.stack.length > 1;

  if (!pattern) {
    return (
      <div>
        <div className="w-full flex items-center justify-center gap-2 py-1 btn-info" style={{ cursor: 'default' }}>
          <span style={titleStyle}>{t('info.title')}</span>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="var(--color-celeste)" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </div>
    );
  }

  const factor = state.unit === 'cm' ? 0.1 : 1;
  const unitLabel = state.unit;
  const fmt = (v: number) => (v * factor).toFixed(2);

  let items: { label: string; value: string }[];

  if (pattern.shape === 'cone' || pattern.shape === 'truncatedCone') {
    items = [
      { label: t('info.slantHeight'), value: `${fmt(pattern.slantHeight)} ${unitLabel}` },
      { label: t('info.arcAngle'),    value: `${pattern.arcAngleDeg.toFixed(2)}°` },
      { label: t('info.arcLength'),   value: `${fmt(pattern.arcLength)} ${unitLabel}` },
      { label: t('info.outerRadius'), value: `${fmt(pattern.outerRadius)} ${unitLabel}` },
    ];
    if (pattern.innerRadius > 0) {
      items.push({ label: t('info.innerRadius'), value: `${fmt(pattern.innerRadius)} ${unitLabel}` });
    }
  } else if (pattern.shape === 'obliqueFrustum') {
    items = [
      { label: t('info.maxSlant'),     value: `${fmt(pattern.slantHeight)} ${unitLabel}` },
      { label: t('info.straightSide'), value: `${fmt(pattern.secondarySlant ?? 0)} ${unitLabel}` },
      { label: t('info.bottomCirc'),   value: `${fmt(pattern.arcLength)} ${unitLabel}` },
      { label: t('info.topCirc'),      value: `${fmt(pattern.secondaryArcLength ?? 0)} ${unitLabel}` },
    ];
  } else {
    items = [
      { label: t('info.frontSlant'),      value: `${fmt(pattern.slantHeight)} ${unitLabel}` },
      { label: t('info.sideSlant'),       value: `${fmt(pattern.secondarySlant ?? 0)} ${unitLabel}` },
      { label: t('info.bottomPerimeter'), value: `${fmt(pattern.arcLength)} ${unitLabel}` },
      { label: t('info.topPerimeter'),    value: `${fmt(pattern.secondaryArcLength ?? 0)} ${unitLabel}` },
    ];
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-2 py-1 btn-info"
      >
        <span style={titleStyle}>{t('info.title')}</span>
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="var(--color-celeste)"
          strokeWidth={3}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </button>

      {showTotal && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 2 }}>
          <span style={{ fontFamily: APPLE_JUICE, fontSize: 9, letterSpacing: '0.12em', color: 'rgba(60,48,38,0.35)' }}>
            {t('stack.composition')}
          </span>
          <span style={{ fontFamily: DIDOT, fontSize: 12, fontStyle: 'italic', color: 'rgba(60,48,38,0.5)' }}>
            ↕ {totalDisplay}
          </span>
        </div>
      )}

      {/* Inline accordion — pushes content down, no floating overlay */}
      <div style={{
        overflow: 'hidden',
        maxHeight: open ? `${items.length * 52}px` : '0px',
        transition: 'max-height 350ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              padding: '7px 4px',
              borderBottom: '1px solid rgba(60,48,38,0.07)',
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0)' : 'translateY(-6px)',
              transition: `opacity 200ms ease ${i * 38}ms, transform 280ms cubic-bezier(0.34,1.56,0.64,1) ${i * 38}ms`,
            }}
          >
            <span style={{
              fontFamily: APPLE_JUICE,
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'rgba(60,48,38,0.45)',
              textTransform: 'lowercase',
            }}>
              {item.label}
            </span>
            <span style={{
              fontFamily: DIDOT,
              fontSize: '15px',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--color-tierra)',
              lineHeight: 1.2,
            }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
