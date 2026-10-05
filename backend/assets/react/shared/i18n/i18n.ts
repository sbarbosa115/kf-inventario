import en from './locales/en.json';

export type Locale = 'en';
type Tree = {[key: string]: string | Tree};
export type Params = Record<string, string | number>;
export type Translate = (key: string, params?: Params) => string;

const CATALOGS: Record<Locale, Tree> = {en};

/**
 * Looks `a.b.c` up in the locale's catalog and fills {{param}} placeholders. A missing key returns the key itself, so
 * a forgotten string is visible instead of blank. A numeric `count` param picks the plural form: `a.b.c_one`,
 * `_other`, … by the locale's rules, falling back to `_other`.
 */
export function translator(locale: Locale): Translate {
  const catalog = CATALOGS[locale];
  const rules = new Intl.PluralRules(locale);
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
