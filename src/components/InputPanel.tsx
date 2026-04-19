import React from 'react';
import { useActiveItem } from '../state/appContext';
import { InputField } from './InputField';
import { useTranslation } from '../i18n/useTranslation';
import type { ValidationError } from '../math/validation';

interface InputPanelProps {
  errors: ValidationError[];
}

function Field({ fieldKey, labelKey, error, compact, separatorLeft }: { fieldKey: string; labelKey: string; error?: string; compact?: boolean; separatorLeft?: boolean }) {
  return (
    <div style={{ minWidth: 0, ...(separatorLeft ? { borderLeft: '1.5px solid rgba(60,48,38,0.13)', paddingLeft: 6 } : {}) }}>
      <InputField fieldKey={fieldKey} labelKey={labelKey} error={error} compact={compact} />
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textAlign: 'center',
  color: 'rgba(60,48,38,0.4)',
};

export function InputPanel({ errors }: InputPanelProps) {
  const activeItem = useActiveItem();
  const { t } = useTranslation();
  const errorMap = new Map(errors.map(e => [e.field, e.messageKey]));

  if (activeItem.shape === 'taperedBox') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', columnGap: 8, rowGap: 6 }}>
        {/* Row 1: group headers — "base" spans cols 1-2, "boca" spans cols 3-4, col 5 empty */}
        <span style={{ ...headerStyle, gridColumn: '1 / 3' }}>{t('group.base')}</span>
        <span style={{ ...headerStyle, gridColumn: '3 / 5' }}>{t('group.top')}</span>
        <div style={{ borderLeft: '1.5px solid rgba(60,48,38,0.13)' }} />
        {/* Row 2: all 5 fields */}
        <Field fieldKey="bottomWidth"  labelKey="input.bottomWidth"  error={errorMap.get('bottomWidth')}  compact />
        <Field fieldKey="bottomLength" labelKey="input.bottomLength" error={errorMap.get('bottomLength')} compact />
        <Field fieldKey="topWidth"     labelKey="input.topWidth"     error={errorMap.get('topWidth')}     compact />
        <Field fieldKey="topLength"    labelKey="input.topLength"    error={errorMap.get('topLength')}    compact />
        <Field fieldKey="height"       labelKey="input.height"       error={errorMap.get('height')}       compact separatorLeft />
      </div>
    );
  }

  let fields: { key: string; label: string }[];

  if (activeItem.shape === 'cone') {
    fields = [
      { key: 'radius', label: 'input.radius' },
      { key: 'height', label: 'input.height' },
    ];
  } else {
    fields = [
      { key: 'bottomRadius', label: 'input.bottomRadius' },
      { key: 'topRadius', label: 'input.topRadius' },
      { key: 'height', label: 'input.height' },
    ];
  }

  return (
    <div className="flex flex-wrap gap-[10px]">
      {fields.map(f => (
        <InputField
          key={f.key}
          fieldKey={f.key}
          labelKey={f.label}
          error={errorMap.get(f.key)}
        />
      ))}
    </div>
  );
}
