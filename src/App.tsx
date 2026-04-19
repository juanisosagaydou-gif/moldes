import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ShapeButtons, UnitSelector } from './components/ShapeSelector';
import { InputPanel } from './components/InputPanel';
import { InfoPanel } from './components/InfoPanel';
import { PrintConfig } from './components/PrintConfig';
import { ExportButtons } from './components/ExportButtons';
import { PatternCanvas } from './components/PatternCanvas';
import { PrintPreview } from './components/PrintPreview';
import { Preview3D } from './components/Preview3D';
import { StackBar } from './components/StackBar';
import { OrganicCursor } from './components/OrganicCursor';
import type { ShapeType } from './types/geometry';
import { usePattern } from './hooks/usePattern';
import type { PatternResult } from './types/geometry';
import type { PackedLayout } from './types/print';
import type { ValidationError } from './math/validation';
import { useTranslation } from './i18n/useTranslation';
import { useAppState } from './state/appContext';

// Pool of all available strip images
const POOL = Array.from({ length: 41 }, (_, i) => `/strip/${i + 3}.png`);
const SLOT_ROTATIONS = [-1.4, 0.9, -0.5, 1.3, -1.8];
const SLOTS_COUNT = 5;

function pickRandomSlots(): number[] {
  const indices = POOL.map((_, i) => i);
  const picked: number[] = [];
  while (picked.length < SLOTS_COUNT) {
    const r = Math.floor(Math.random() * indices.length);
    picked.push(indices.splice(r, 1)[0]);
  }
  return picked;
}

const PRINT_PANEL_GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E";

function StripItem({
  src, baseRotation, stripH, scale, extraTilt, onMouseEnter, onMouseLeave,
}: {
  src: string; baseRotation: number; stripH: number;
  scale: number; extraTilt: number;
  onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const imgH = Math.min(Math.round(stripH * 1.05), 340);
  return (
    <img
      src={src}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        flexShrink: 0,
        height: imgH,
        maxWidth: 220,
        width: 'auto',
        objectFit: 'contain',
        display: 'block',
        transform: `rotate(${baseRotation + extraTilt}deg) scale(${scale})`,
        transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 400ms ease',
        transformOrigin: 'center bottom',
        cursor: 'default',
      }}
    />
  );
}

type MobileTab = 'forma' | 'medidas' | 'info' | 'imprimir';

interface MobileLayoutProps {
  pattern: PatternResult | null;
  allPatterns: PatternResult[];
  layout: PackedLayout | null;
  errors: ValidationError[];
}

function MobileLayout({ pattern, allPatterns, layout, errors }: MobileLayoutProps) {
  const { t } = useTranslation();
  const { state, dispatch } = useAppState();
  const [activeTab, setActiveTab] = useState<MobileTab | null>(null);

  const toggleTab = (tab: MobileTab) =>
    setActiveTab(prev => (prev === tab ? null : tab));

  const sheetOpen = activeTab !== null;

  const tabs: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'forma',
      label: t('mobile.tabForma'),
      icon: (
        // Sector arc — la forma que genera la app
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
          <path d="M12 20 L4 9 A10.8 10.8 0 0 1 20 9 Z" />
        </svg>
      ),
    },
    {
      id: 'medidas',
      label: t('mobile.tabMedidas'),
      icon: (
        // Compás de dibujo técnico
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width="20" height="20">
          <line x1="12" y1="3" x2="6" y2="17" />
          <line x1="12" y1="3" x2="18" y2="17" />
          <path d="M7.5 13.5 A6 6 0 0 0 16.5 13.5" />
        </svg>
      ),
    },
    {
      id: 'info',
      label: t('mobile.tabInfo'),
      icon: (
        // Marca de registro de impresión — guiño editorial
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width="20" height="20">
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="3" x2="12" y2="7.5" />
          <line x1="12" y1="16.5" x2="12" y2="21" />
          <line x1="3" y1="12" x2="7.5" y2="12" />
          <line x1="16.5" y1="12" x2="21" y2="12" />
        </svg>
      ),
    },
    {
      id: 'imprimir',
      label: t('mobile.tabImprimir'),
      icon: (
        // Hoja con esquina doblada
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
          <path d="M6 3 H15 L18 6 V21 H6 Z" />
          <path d="M15 3 V6 H18" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--color-lino)' }}>

      {/* Compact mobile header */}
      <header
        className="grain-header relative flex-shrink-0 flex items-center justify-center px-4"
        style={{
          background: 'var(--color-verde)',
          height: 52,
          overflow: 'hidden',
        }}
      >
        <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
          <defs>
            <filter id="f-lino-m" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} result="noise" stitchTiles="stitch" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={1.2} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: "'Didot', 'GFS Didot', 'Bodoni MT', 'Playfair Display', serif",
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-lino)',
            filter: 'url(#f-lino-m)',
            lineHeight: 1,
          }}>
            {t('app.title')}
          </span>
          <p style={{
            fontSize: 7,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-lino)',
            opacity: 0.45,
            lineHeight: 1,
            fontFamily: "'Inter', sans-serif",
          }}>
            {t('app.subtitle')}
          </p>
        </div>

        <button
          style={{
            position: 'absolute',
            right: 16,
            fontSize: 9,
            fontWeight: 600,
            border: '1px solid rgba(242,235,226,0.3)',
            borderRadius: 3,
            padding: '2px 6px',
            color: 'var(--color-lino)',
            opacity: 0.7,
            background: 'none',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          onClick={() => dispatch({ type: 'SET_LANGUAGE', payload: state.language === 'es' ? 'en' : 'es' })}
        >
          {state.language.toUpperCase()}
        </button>
      </header>

      {/* Canvas — fills all remaining space; paddingBottom reserves room for fixed tab bar */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', padding: 12, paddingBottom: 64, background: 'var(--color-celeste)' }}>
        <PatternCanvas pattern={pattern} tiling={layout} />
      </main>

      {/* Backdrop */}
      <div
        onClick={() => setActiveTab(null)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(60,48,38,0.28)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
          opacity: sheetOpen ? 1 : 0,
          pointerEvents: sheetOpen ? 'auto' : 'none',
          transition: 'opacity 250ms ease',
        }}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 52,
          left: 0,
          right: 0,
          maxHeight: '72vh',
          background: '#F4EDE1',
          borderRadius: '10px 10px 0 0',
          boxShadow: '0 -4px 32px rgba(60,48,38,0.18)',
          transform: sheetOpen ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle — editorial */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 80 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(60,48,38,0.15)' }} />
            <div style={{ width: 5, height: 5, background: 'rgba(60,48,38,0.22)', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ flex: 1, height: 1, background: 'rgba(60,48,38,0.15)' }} />
          </div>
        </div>

        {/* Sheet grain */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${PRINT_PANEL_GRAIN}")`,
            backgroundSize: '200px 200px',
            opacity: 0.05,
            mixBlendMode: 'soft-light',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Sheet content — scrollable */}
        <div style={{ overflowY: 'auto', padding: '4px 20px 24px', flex: 1, position: 'relative', zIndex: 1 }}>
          {activeTab && (
            <div style={{
              textAlign: 'center',
              fontFamily: "'Apple Juice', cursive",
              fontSize: 10,
              letterSpacing: '0.22em',
              color: 'rgba(60,48,38,0.28)',
              marginBottom: 14,
            }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </div>
          )}
          {activeTab === 'forma' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ShapeButtons />
              <UnitSelector />
            </div>
          )}
          {activeTab === 'medidas' && (
            <InputPanel errors={errors} />
          )}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <InfoPanel pattern={pattern} />
              <Preview3D />
              {/* Stack navigation chips — tap to switch active piece */}
              {state.stack.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                  {state.stack.map((item, idx) => {
                    const isActive = item.id === state.activeStackId;
                    const shapeIcons: Record<ShapeType, string> = {
                      cone: '△', truncatedCone: '⌂', obliqueFrustum: '◇', taperedBox: '□',
                    };
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_STACK_ITEM', payload: item.id });
                          setActiveTab('medidas');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '5px 10px',
                          borderRadius: 3,
                          background: isActive ? 'rgba(204,204,115,0.18)' : 'rgba(60,48,38,0.07)',
                          border: isActive ? '1px solid var(--color-lima)' : '1px solid transparent',
                          color: isActive ? 'var(--color-tierra)' : 'rgba(60,48,38,0.5)',
                          fontFamily: "'Apple Juice', cursive",
                          fontSize: 10,
                          letterSpacing: '0.08em',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{shapeIcons[item.shape as ShapeType]}</span>
                        <span>{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'imprimir' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PrintConfig layout={layout} />
              <ExportButtons pattern={pattern} allPatterns={allPatterns} layout={layout} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom tab bar — 4 tabs + circular + in center */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 52,
          background: '#F4EDE1',
          borderTop: '1px solid rgba(60,48,38,0.12)',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 60,
          flexShrink: 0,
        }}
      >
        {/* Left half: forma + medidas */}
        {tabs.slice(0, 2).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => toggleTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                color: isActive ? 'var(--color-lima)' : 'rgba(60,48,38,0.38)',
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: "'Apple Juice', cursive",
                fontWeight: 400,
                transition: 'color 150ms ease',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%',
                  height: 2, background: 'var(--color-lima)', borderRadius: '0 0 2px 2px',
                }} />
              )}
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Center + button */}
        <div style={{ width: 64, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2 }}>
          <button
            onClick={() => {
              dispatch({ type: 'ADD_STACK_ITEM' });
              setActiveTab('forma');
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--color-celeste)',
              border: '3px solid #F4EDE1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-rojo)',
              boxShadow: '0 2px 10px rgba(45,72,42,0.28)',
              transform: 'translateY(-10px)',
              transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease',
              flexShrink: 0,
            }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-10px) scale(0.93)'; }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-10px)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="7" y1="1" x2="7" y2="13" />
              <line x1="1" y1="7" x2="13" y2="7" />
            </svg>
          </button>
        </div>

        {/* Right half: info + imprimir */}
        {tabs.slice(2).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => toggleTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                color: isActive ? 'var(--color-lima)' : 'rgba(60,48,38,0.38)',
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: "'Apple Juice', cursive",
                fontWeight: 400,
                transition: 'color 150ms ease',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%',
                  height: 2, background: 'var(--color-lima)', borderRadius: '0 0 2px 2px',
                }} />
              )}
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}

export default function App() {
  const { pattern, allPatterns, layout, errors } = usePattern();
  const { t } = useTranslation();
  const [slots, setSlots] = useState<number[]>(pickRandomSlots);
  const ref3D = useRef<HTMLDivElement>(null);
  const refAside = useRef<HTMLElement>(null);
  const refSidebarContent = useRef<HTMLDivElement>(null);
  const [stripHeight, setStripHeight] = useState(120);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hoveredStripIdx, setHoveredStripIdx] = useState<number | null>(null);
  const [stripHoverTilt, setStripHoverTilt] = useState(0);

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleStripEnter = useCallback((idx: number) => {
    const sign = Math.random() < 0.5 ? -1 : 1;
    setStripHoverTilt(sign * (4 + Math.random() * 9));
    setHoveredStripIdx(idx);
  }, []);

  const handleStripLeave = useCallback(() => {
    setHoveredStripIdx(null);
  }, []);

  const updateStripHeight = useCallback(() => {
    if (!ref3D.current) return;
    const bottom = ref3D.current.getBoundingClientRect().bottom;
    setStripHeight(Math.max(0, Math.round(window.innerHeight - bottom)));
  }, []);

  useLayoutEffect(() => {
    if (isMobile) return;
    updateStripHeight();
    const ro = new ResizeObserver(updateStripHeight);
    if (ref3D.current) ro.observe(ref3D.current);
    if (refAside.current) ro.observe(refAside.current);
    if (refSidebarContent.current) ro.observe(refSidebarContent.current);
    const scrollable = refSidebarContent.current;
    scrollable?.addEventListener('scroll', updateStripHeight);
    window.addEventListener('resize', updateStripHeight);
    return () => {
      ro.disconnect();
      scrollable?.removeEventListener('scroll', updateStripHeight);
      window.removeEventListener('resize', updateStripHeight);
    };
  }, [updateStripHeight, isMobile]);

  useEffect(() => {
    if (!pattern) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(prev => {
      const available = POOL.map((_, i) => i).filter(i => !prev.includes(i));
      if (available.length === 0) return prev;
      const next = [...prev];
      const slotIdx = Math.floor(Math.random() * SLOTS_COUNT);
      const poolIdx = available[Math.floor(Math.random() * available.length)];
      next[slotIdx] = poolIdx;
      return next;
    });
  }, [pattern]);

  if (isMobile) return <MobileLayout pattern={pattern} allPatterns={allPatterns} layout={layout} errors={errors} />;

  return (
    <div className="flex h-screen">

      {/* Left sidebar */}
      <aside
        ref={refAside}
        className="w-[320px] flex-shrink-0 flex flex-col h-full"
        style={{
          backgroundColor: '#F4EDE1',
          borderRight: '1px solid rgba(204,204,115,0.20)',
        }}
      >
        <Header />

        {/* Scrollable top content */}
        <div ref={refSidebarContent} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 px-5 py-3">
          <div className="flex flex-col gap-2">
            <ShapeButtons />
            <UnitSelector />
            <InputPanel errors={errors} />
            <StackBar />
          </div>
          <div style={{ marginTop: '8px' }}>
            <InfoPanel pattern={pattern} />
          </div>
          <div ref={ref3D} className="flex-1 min-h-0">
            <Preview3D />
          </div>
        </div>

        {/* Print section — siempre al fondo */}
        <div
          className="flex-shrink-0 flex flex-col gap-2 px-5 py-3"
          style={{ borderTop: '1px solid rgba(60,48,38,0.08)' }}
        >
          <PrintConfig layout={layout} />
          <ExportButtons pattern={pattern} allPatterns={allPatterns} layout={layout} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden vignette-main">

        {/* Left column: canvas + strip */}
        <div className="flex-1 flex flex-col overflow-hidden">

          <div className="flex-1 min-h-0 flex p-4">
            <PatternCanvas pattern={pattern} tiling={layout} />
          </div>

          {/* Image strip — aligned with canvas, stops before print panel */}
          <div
            data-cursor="strip"
            className="flex-shrink-0 flex items-end justify-around px-2 gap-1"
            style={{
              height: stripHeight,
              position: 'relative',
              zIndex: 5,
              borderTop: '1px solid rgba(60,48,38,0.09)',
              background: '#aec3d1',
              overflowX: 'clip',
              overflowY: 'visible',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("${PRINT_PANEL_GRAIN}")`,
                backgroundSize: '200px 200px',
                opacity: 0.22,
                mixBlendMode: 'overlay',
                pointerEvents: 'none',
              }}
            />
            {slots.map((poolIdx, slotIdx) => {
              const dist = hoveredStripIdx === null ? Infinity : Math.abs(slotIdx - hoveredStripIdx);
              const scale = dist === 0 ? 1.38 : dist === 1 ? 1.16 : dist === 2 ? 1.06 : 1;
              const extraTilt = hoveredStripIdx === slotIdx ? stripHoverTilt : 0;
              return (
                <StripItem
                  key={slotIdx}
                  src={POOL[poolIdx]}
                  baseRotation={SLOT_ROTATIONS[slotIdx]}
                  stripH={stripHeight}
                  scale={scale}
                  extraTilt={extraTilt}
                  onMouseEnter={() => handleStripEnter(slotIdx)}
                  onMouseLeave={handleStripLeave}
                />
              );
            })}
          </div>

        </div>

        {/* Right column: dark print preview panel — collapsible */}
        {pattern && layout && (
          <div
            className="flex-shrink-0 relative"
            style={{
              width: previewOpen ? 180 : 22,
              transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'var(--color-tierra)',
              overflow: 'hidden',
              willChange: 'width',
            }}
          >
            {/* Grain overlay on dark panel */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("${PRINT_PANEL_GRAIN}")`,
                backgroundSize: '200px 200px',
                opacity: 0.14,
                mixBlendMode: 'overlay',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />

            {/* Toggle button — always visible */}
            <button
              onClick={() => setPreviewOpen(v => !v)}
              aria-label={previewOpen ? 'Ocultar vista previa' : 'Mostrar vista previa'}
              title={previewOpen ? 'Ocultar vista previa' : 'Mostrar vista previa'}
              style={{
                position: 'absolute',
                top: 10,
                left: 0,
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-lima)',
                zIndex: 3,
                borderRadius: 3,
                transition: 'color 150ms',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F4EDE1')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-lima)')}
            >
              <svg
                width="13" height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  display: 'block',
                  flexShrink: 0,
                  transform: previewOpen ? 'rotate(-90deg)' : 'rotate(90deg)',
                  transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>

            {/* Collapsed spine label */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(90deg)',
                color: '#F4EDE1',
                fontSize: 7,
                letterSpacing: '0.22em',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                pointerEvents: 'none',
                opacity: previewOpen ? 0 : 1,
                transition: 'opacity 150ms',
                zIndex: 2,
              }}
            >
              {t('preview.spineLabel').toUpperCase()}
            </div>

            {/* Scrollable content */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '10px 10px 12px',
                opacity: previewOpen ? 1 : 0,
                transition: 'opacity 180ms',
                pointerEvents: previewOpen ? 'auto' : 'none',
                zIndex: 2,
              }}
            >
              <PrintPreview pattern={pattern} layout={layout} />
            </div>
          </div>
        )}

      </main>

      <OrganicCursor />

      {/* Decorative: editorial page number */}
      <div
        className="hidden md:block"
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '9px',
          letterSpacing: '0.08em',
          color: 'var(--color-tierra)',
          opacity: 0.35,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 50,
        }}
      >
        — 01 —
      </div>

      {/* Decorative: book-spine lateral text */}
      <div
        className="hidden md:block"
        aria-hidden="true"
        style={{
          position: 'fixed',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          writingMode: 'vertical-rl',
          fontSize: '8px',
          letterSpacing: '0.3em',
          color: 'var(--color-tierra)',
          opacity: 0.25,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 50,
          whiteSpace: 'nowrap',
        }}
      >
        DISEÑO DE FORMAS
      </div>

    </div>
  );
}
