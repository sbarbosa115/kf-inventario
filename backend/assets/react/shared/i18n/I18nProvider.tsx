import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  detectLocale,
  LOCALE_KEY,
  translator,
  type Locale,
  type Translate,
} from './i18n';

interface I18n {
  locale: Locale;
  t: Translate;
  /** Switches the language: remembered per browser (kf.locale), the page keeps its route and data. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n | null>(null);

/**
 * The UI language, English or Spanish: the remembered one, else the browser's, else English. Writes <html lang>.
 * `locale` fixes it (tests).
 */
export function I18nProvider({
  locale: fixed,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const [locale, setCurrent] = useState<Locale>(() => fixed ?? detectLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Storage refused: the choice lasts until the page reloads.
    }
    setCurrent(next);
  }, []);

  const value = useMemo(
    () => ({locale, t: translator(locale), setLocale}),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Outside a provider (a component test) it answers in English. */
export function useTranslation(): I18n {
  return useContext(I18nContext) ?? FALLBACK;
}

const FALLBACK: I18n = {
  locale: 'en',
  t: translator('en'),
  setLocale: () => undefined,
};
