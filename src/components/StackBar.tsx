import React, { useRef, useState, useCallback } from 'react';
import { useAppState, useActiveItem } from '../state/appContext';
import { useTranslation } from '../i18n/useTranslation';
import type { StackItem } from '../types/app';
import type { ShapeType } from '../types/geometry';

const APPLE_JUICE = "'Apple Juice', cursive";
const INTER = "'Inter', sans-serif";

// ─── Shape mini-icons ────────────────────────────────────────────────────────

function ShapeIcon({ shape, size = 14 }: { shape: ShapeType; size?: number }) {
  const s = size;
  switch (shape) {
    case 'cone':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3 L22 21 H2 Z" />
        </svg>
      );
    case 'truncatedCone':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 6 H17 L22 21 H2 Z" />
        </svg>
      );
    case 'obliqueFrustum':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3 L5 21 L21 21 L17 3 Z" />
        </svg>
      );
    case 'taperedBox':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 8 L15 8 L19 22 L1 22 Z" />
        </svg>
      );
  }
}

// ─── Single chip ─────────────────────────────────────────────────────────────

interface ChipProps {
  item: StackItem;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  unit: string;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

function Chip({
  item, index, isActive, canDelete, unit, isDragging, isDragOver,
  onSelect, onDelete, onDragStart, onDragOver, onDrop, onDragEnd,
}: ChipProps) {
  const [hovered, setHovered] = useState(false);
  const height = item.inputs.height ?? '–';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '6px 8px 5px',
        borderRadius: 3,
        cursor: isDragging ? 'grabbing' : 'pointer',
        background: isActive
          ? 'rgba(204,204,115,0.13)'
          : hovered
          ? 'rgba(60,48,38,0.05)'
          : 'transparent',
        borderBottom: isActive
          ? '2px solid var(--color-lima)'
          : '2px solid transparent',
        opacity: isDragging ? 0.4 : isDragOver ? 0.7 : 1,
        transition: 'background 150ms ease, opacity 120ms ease',
        minWidth: 44,
        userSelect: 'none',
      }}
    >
      {/* drag handle — top */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 2,
            pointerEvents: 'none',
          }}
        >
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 2,
                height: 2,
                borderRadius: '50%',
                background: 'rgba(60,48,38,0.25)',
              }}
            />
          ))}
        </div>
      )}

      <div
        style={{
          color: isActive ? 'var(--color-lima)' : 'rgba(60,48,38,0.55)',
          transition: 'color 150ms ease',
        }}
      >
        <ShapeIcon shape={item.shape} size={16} />
      </div>

      <span
        style={{
          fontFamily: APPLE_JUICE,
          fontSize: 9,
          letterSpacing: '0.06em',
          color: isActive ? 'var(--color-tierra)' : 'rgba(60,48,38,0.4)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {height}{unit}
      </span>

      {/* delete button — hover only */}
      {canDelete && hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--color-tierra)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 2,
          }}
        >
          <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="var(--color-lino)" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="8" y2="8" />
            <line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Main StackBar ────────────────────────────────────────────────────────────

export function StackBar() {
  const { state, dispatch } = useAppState();
  const activeItem = useActiveItem();
  const { t } = useTranslation();
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const totalMm = state.stack.reduce((sum, item) => {
    const h = parseFloat(item.inputs.height ?? '0') || 0;
    return sum + (state.unit === 'cm' ? h * 10 : h);
  }, 0);
  const limitReached = totalMm >= 500;

  const totalDisplay = state.unit === 'cm'
    ? `${(totalMm / 10).toFixed(1).replace(/\.0$/, '')}cm`
    : `${Math.round(totalMm)}mm`;

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === toIndex) return;
    dispatch({ type: 'REORDER_STACK_ITEM', payload: { fromIndex, toIndex } });
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingIndex(null);
  }, [dispatch]);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingIndex(null);
  }, []);

  const canDelete = state.stack.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Chips */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}
        >
          {state.stack.map((item, index) => (
            <Chip
              key={item.id}
              item={item}
              index={index}
              isActive={item.id === activeItem.id}
              canDelete={canDelete}
              unit={state.unit}
              isDragging={draggingIndex === index}
              isDragOver={dragOverIndex === index && draggingIndex !== index}
              onSelect={() => dispatch({ type: 'SET_ACTIVE_STACK_ITEM', payload: item.id })}
              onDelete={() => dispatch({ type: 'REMOVE_STACK_ITEM', payload: item.id })}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={() => dispatch({ type: 'ADD_STACK_ITEM' })}
          disabled={limitReached}
          title={limitReached ? t('stack.limitReached') : t('stack.add')}
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: 3,
            background: limitReached ? 'rgba(60,48,38,0.08)' : 'var(--color-celeste)',
            border: 'none',
            cursor: limitReached ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: limitReached ? 'rgba(60,48,38,0.3)' : 'var(--color-rojo)',
            transition: 'background 200ms ease, transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            marginLeft: 4,
          }}
          onMouseEnter={e => {
            if (!limitReached) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'none';
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" />
            <line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </button>
      </div>

      {/* Height indicator */}
      {state.stack.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            paddingLeft: 2,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'rgba(60,48,38,0.08)' }} />
          <span
            style={{
              fontFamily: INTER,
              fontSize: 8,
              letterSpacing: '0.1em',
              color: limitReached ? 'var(--color-rojo)' : 'rgba(60,48,38,0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            {totalDisplay} / 50cm
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(60,48,38,0.08)' }} />
        </div>
      )}
    </div>
  );
}
