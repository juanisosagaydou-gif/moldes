import { useAppState } from '../state/appContext';
import { useTranslation } from '../i18n/useTranslation';

const titleBase = {
  fontFamily: "'Didot', 'GFS Didot', 'Bodoni MT', 'Playfair Display', serif",
  fontWeight: 400,
  fontSize: '38px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  lineHeight: 1,
  whiteSpace: 'nowrap' as const,
};

export function Header() {
  const { state, dispatch } = useAppState();
  const { t } = useTranslation();

  return (
    <header
      className="relative px-5 pt-10 pb-7 mb-4 text-center flex-shrink-0 overflow-hidden grain-header"
      style={{ background: 'var(--color-verde)' }}
    >
      <svg
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="f-lino" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} result="noise" stitchTiles="stitch" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={1.2} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Offset-print title — three misregistered layers simulating 70s lithography */}
      <div className="relative inline-block" style={{ lineHeight: 1 }}>

        {/* Ghost span — in-flow, defines container size, invisible */}
        <span style={{ ...titleBase, visibility: 'hidden', display: 'block' }}>
          {t('app.title')}
        </span>

        <span style={{
          ...titleBase,
          position: 'absolute',
          top: 0,
          left: 0,
          color: 'var(--color-lino)',
          filter: 'url(#f-lino)',
        }}>
          {t('app.title')}
        </span>

      </div>

      <p
        className="text-[9px] tracking-[0.12em] uppercase mt-1.5 leading-none"
        style={{ color: 'var(--color-lino)', opacity: 0.55 }}
      >
        {t('app.subtitle')}
      </p>

      <div
        aria-hidden="true"
        style={{
          height: '1px',
          width: '85%',
          margin: '8px auto 0',
          background: 'rgba(242, 235, 226, 0.18)',
        }}
      />

      <button
        className="btn-lang absolute top-5 right-4 text-[9px] font-semibold border px-2 py-[3px] tracking-[0.1em] uppercase"
        style={{ color: 'var(--color-lino)', opacity: 0.7, borderColor: 'rgba(242,235,226,0.3)' }}
        onClick={() =>
          dispatch({
            type: 'SET_LANGUAGE',
            payload: state.language === 'es' ? 'en' : 'es',
          })
        }
      >
        {state.language.toUpperCase()}
      </button>
    </header>
  );
}
