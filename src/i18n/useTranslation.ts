import { useAppState } from '../state/appContext';
import { es } from './es';
import { en } from './en';

const strings: Record<string, Record<string, string>> = { es, en };

export function useTranslation() {
  const { state } = useAppState();
  const lang = state.language;
  const t = (key: string): string => strings[lang]?.[key] ?? key;
  return { t, lang };
}
