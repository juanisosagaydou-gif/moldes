import { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { useAppState, useActiveItem } from '../state/appContext';

interface InputFieldProps {
  fieldKey: string;
  labelKey: string;
  error?: string;
  compact?: boolean;
}

const DIDOT = "'Didot', 'GFS Didot', 'Bodoni MT', 'Playfair Display', serif";
const APPLE_JUICE = "'Apple Juice', cursive";

export function InputField({ fieldKey, labelKey, error, compact }: InputFieldProps) {
  const { dispatch } = useAppState();
  const activeItem = useActiveItem();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);

  const value = activeItem.inputs[fieldKey] ?? '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      dispatch({ type: 'SET_INPUT', payload: { key: fieldKey, value: raw } });
    }
  };

  const borderColor = error
    ? 'var(--color-rojo)'
    : focused
    ? 'var(--color-tierra)'
    : 'rgba(60,48,38,0.2)';

  return (
    <div className="flex-1 flex flex-col items-center gap-0.5">
      <div className="relative w-full group">
        <input
          id={fieldKey}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full px-1 text-center focus:outline-none ${compact ? 'h-[40px]' : 'h-[60px]'}`}
          style={{
            fontFamily: DIDOT,
            fontSize: compact ? '18px' : '26px',
            fontWeight: 400,
            background: 'transparent',
            border: 'none',
            borderBottom: `1.5px solid ${borderColor}`,
            borderRadius: 0,
            color: error ? 'var(--color-rojo)' : 'var(--color-tierra)',
            transition: 'border-color 200ms ease',
            boxShadow: 'none',
          }}
        />
        {error && (
          <div
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
                       opacity-0 group-hover:opacity-100 transition-opacity duration-150
                       px-2 py-1 text-[10px] whitespace-nowrap z-30"
            style={{
              background: 'var(--color-tierra)',
              color: 'var(--color-lino)',
              borderRadius: '2px',
            }}
          >
            {t(error)}
            <span
              className="absolute top-full left-1/2 -translate-x-1/2"
              style={{
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '4px solid var(--color-tierra)',
              }}
            />
          </div>
        )}
      </div>
      <label
        htmlFor={fieldKey}
        style={{
          marginTop: '3px',
          fontFamily: APPLE_JUICE,
          fontSize: '11px',
          lineHeight: 1,
          color: 'rgba(60,48,38,0.55)',
          cursor: 'default',
        }}
      >
        {t(`${labelKey}.symbol`)}
      </label>
    </div>
  );
}
