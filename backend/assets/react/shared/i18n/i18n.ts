import en from './locales/en';
import es from './locales/es';

export type Locale = 'en' | 'es';
type Tree = {[key: string]: string | Tree};
export type Params = Record<string, string | number>;
export type Translate = (key: string, params?: Params) => string;

export const LOCALES: readonly Locale[] = ['en', 'es'];
const CATALOGS: Record<Locale, Tree> = {en, es};
/** Numbers, money and dates: the US for English, Colombia (the company's base) for Spanish (Decisions 7). */
const INTL: Record<Locale, string> = {en: 'en-US', es: 'es-CO'};
export const LOCALE_KEY = 'kf.locale';

export function intlLocale(locale: Locale): string {
  return INTL[locale];
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

/** The remembered language (localStorage kf.locale), else the browser's (es* → es), else English. */
export function detectLocale(): Locale {
  try {
    const remembered = localStorage.getItem(LOCALE_KEY);
    if (isLocale(remembered)) return remembered;
  } catch {
    // Storage refused: fall through to the browser's language.
  }
  const language =
    typeof navigator === 'undefined' ? '' : String(navigator.language ?? '');
  return language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Looks `a.b.c` up in the locale's catalog and fills {{param}} placeholders. A missing key returns the key itself, so
 * a forgotten string is visible instead of blank. A numeric `count` param picks the plural form: `a.b.c_one`,
 * `_other`, … by the locale's rules, falling back to `_other`.
 */
export function translator(locale: Locale): Translate {
  const catalog = CATALOGS[locale];
  const rules = new Intl.PluralRules(INTL[locale]);
  const lookup = (key: string): string | undefined => {
    let value: string | Tree | undefined = catalog;
    for (const part of key.split('.')) {
      value = typeof value === 'object' ? value[part] : undefined;
    }
    return typeof value === 'string' ? value : undefined;
  };
  return (key, params) => {
    const count = params?.count;
    const value =
      lookup(key) ??
      (typeof count === 'number'
        ? (lookup(`${key}_${rules.select(count)}`) ?? lookup(`${key}_other`))
        : undefined);
    if (value === undefined) return key;
    let text = value;
    for (const [name, param] of Object.entries(params ?? {})) {
      text = text.split(`{{${name}}}`).join(String(param));
    }
    return text;
  };
}
