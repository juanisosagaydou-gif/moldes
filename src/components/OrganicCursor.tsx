import { useEffect, useRef } from 'react';

type Zone = 'default' | 'canvas' | 'button' | 'input' | 'strip';

function detectZone(el: EventTarget | null): Zone {
  if (!(el instanceof Element)) return 'default';
  let node: Element | null = el;
  while (node) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return 'input';
    const dc = node.getAttribute('data-cursor');
    if (dc) return dc as Zone;
    if (tag === 'button') return 'button';
    node = node.parentElement;
  }
  return 'default';
}

export function OrganicCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const crossRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -200, y: -200 });
  const ringPos = useRef({ x: -200, y: -200 });
  const zone = useRef<Zone>('default');
  const hoveredBtn = useRef<HTMLElement | null>(null);
  const rafId = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add('cursor-organic');
    return () => {
      document.documentElement.classList.remove('cursor-organic');
    };
  }, []);

  useEffect(() => {
    // tick uses function declaration so onMove can reference it before its definition
    function tick() {
      // Pause entirely when tab is hidden — browser won't fire rAF anyway,
      // but we also need to stop rescheduling so we don't accumulate frames.
      if (document.hidden) {
        rafId.current = 0;
        return;
      }

      const dRx = mouse.current.x - ringPos.current.x;
      const dRy = mouse.current.y - ringPos.current.y;
      ringPos.current.x += dRx * 0.20;
      ringPos.current.y += dRy * 0.20;

      const dot = dotRef.current;
      const ring = ringRef.current;
      const cross = crossRef.current;
      if (!dot || !ring || !cross) { rafId.current = requestAnimationFrame(tick); return; }

      const z = zone.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const rx = ringPos.current.x;
      const ry = ringPos.current.y;

      if (z === 'input') {
        dot.style.opacity = '0';
        ring.style.opacity = '0';
        cross.style.opacity = '0';
      } else if (z === 'strip') {
        dot.style.opacity = '0';
        ring.style.opacity = '0';
        cross.style.opacity = '0.6';
        cross.style.transform = `translate(${mx}px, ${my}px)`;
      } else if (z === 'canvas') {
        dot.style.opacity = '1';
        dot.style.width = '7px';
        dot.style.height = '7px';
        dot.style.transform = `translate(${mx - 3.5}px, ${my - 3.5}px)`;
        ring.style.opacity = '0.65';
        ring.style.width = '20px';
        ring.style.height = '20px';
        ring.style.transform = `translate(${rx - 10}px, ${ry - 10}px)`;
        cross.style.opacity = '0';
      } else if (z === 'button') {
        dot.style.opacity = '0.8';
        dot.style.width = '4px';
        dot.style.height = '4px';
        dot.style.transform = `translate(${mx - 2}px, ${my - 2}px)`;
        ring.style.opacity = '0.55';
        ring.style.width = '28px';
        ring.style.height = '28px';
        ring.style.transform = `translate(${rx - 14}px, ${ry - 14}px)`;
        cross.style.opacity = '0';
        if (hoveredBtn.current) {
          const rect = hoveredBtn.current.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = ((mx - cx) / (rect.width * 0.5)) * 2.5;
          const dy = ((my - cy) / (rect.height * 0.5)) * 2.5;
          hoveredBtn.current.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
        }
      } else {
        dot.style.opacity = '0.9';
        dot.style.width = '5px';
        dot.style.height = '5px';
        dot.style.transform = `translate(${mx - 2.5}px, ${my - 2.5}px)`;
        ring.style.opacity = '0.45';
        ring.style.width = '16px';
        ring.style.height = '16px';
        ring.style.transform = `translate(${rx - 8}px, ${ry - 8}px)`;
        cross.style.opacity = '0';
      }

      // Self-halt when cursor is stationary and the ring has fully converged.
      // mousemove or visibilitychange will restart the loop.
      if (Math.abs(dRx) < 0.05 && Math.abs(dRy) < 0.05) {
        rafId.current = 0;
        return;
      }

      rafId.current = requestAnimationFrame(tick);
    }

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      zone.current = detectZone(e.target);

      if (zone.current === 'button') {
        const btn = (e.target as Element).closest('button') as HTMLElement | null;
        if (btn !== hoveredBtn.current) {
          if (hoveredBtn.current) hoveredBtn.current.style.translate = 'none';
          hoveredBtn.current = btn;
        }
      } else {
        if (hoveredBtn.current) {
          hoveredBtn.current.style.translate = 'none';
          hoveredBtn.current = null;
        }
      }

      // Restart the rAF loop if it went idle
      if (rafId.current === 0) {
        rafId.current = requestAnimationFrame(tick);
      }
    };

    const onVisibility = () => {
      if (!document.hidden && rafId.current === 0) {
        rafId.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    rafId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
      if (hoveredBtn.current) hoveredBtn.current.style.translate = 'none';
    };
  }, []);

  return (
    <>
      {/* Dot — follows cursor exactly */}
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: 5, height: 5,
          background: 'var(--color-tierra)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 99999,
          willChange: 'transform',
          opacity: 0,
          mixBlendMode: 'multiply',
          transition: 'width 220ms cubic-bezier(0.34,1.56,0.64,1), height 220ms cubic-bezier(0.34,1.56,0.64,1), opacity 120ms ease',
        }}
      />
      {/* Ring — lags behind with lerp */}
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: 16, height: 16,
          border: '1px solid rgba(60,48,38,0.42)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 99999,
          willChange: 'transform',
          opacity: 0,
          transition: 'width 200ms cubic-bezier(0.34,1.56,0.64,1), height 200ms cubic-bezier(0.34,1.56,0.64,1), opacity 100ms ease',
        }}
      />
      {/* Cross — registration mark for strip zone */}
      <div
        ref={crossRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: 0, left: 0,
          pointerEvents: 'none',
          zIndex: 99999,
          opacity: 0,
          transition: 'opacity 100ms ease',
        }}
      >
        <div style={{ position: 'absolute', width: 16, height: 1, background: 'rgba(60,48,38,0.55)', top: 0, left: -8 }} />
        <div style={{ position: 'absolute', width: 1, height: 16, background: 'rgba(60,48,38,0.55)', top: -8, left: 0 }} />
        <div style={{ position: 'absolute', width: 4, height: 4, border: '1px solid rgba(60,48,38,0.55)', borderRadius: '50%', top: -2, left: -2 }} />
      </div>
    </>
  );
}
