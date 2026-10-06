import {detectLocale, intlLocale, translator} from './i18n';
import en from './locales/en';
import es from './locales/es';

type Tree = {[key: string]: string | Tree};

/** Every leaf key of a catalogue, as a.b.c, with its value. */
function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value, `${prefix}${key}.`),
  );
}

/** The {{placeholders}} a text uses, sorted. */
const placeholders = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

const PREFIXES = [
  'common',
  'nav',
  'auth',
  'errors',
  'users',
  'products',
  'stock',
  'customers',
  'address',
  'orders',
  'orderForm',
  'gettingReady',
  'invoices',
  'roles',
  'filters',
  'settings',
  'shops',
  'comments',
];

describe('translator', () => {
  it('fills the placeholders', () => {
    expect(translator('en')('common.pageOf', {page: 2, pages: 5})).toBe(
      'Page 2 of 5',
    );
    expect(translator('es')('common.pageOf', {page: 2, pages: 5})).toBe(
      'Página 2 de 5',
    );
  });

  it('shows a missing key instead of nothing, so a forgotten string is seen', () => {
    expect(translator('en')('nope.missing')).toBe('nope.missing');
    expect(translator('es')('nope.missing')).toBe('nope.missing');
  });

  it('picks the plural form by the language', () => {
    expect(translator('es')('products.selected', {count: 1})).toBe(
      '1 producto seleccionado',
    );
    expect(translator('es')('products.selected', {count: 3})).toBe(
      '3 productos seleccionados',
    );
  });
});

describe('the catalogues', () => {
  it('have one file per prefix, the same in both languages', () => {
    expect(Object.keys(en).sort()).toEqual([...PREFIXES].sort());
    expect(Object.keys(es).sort()).toEqual([...PREFIXES].sort());
  });

  it('have the same keys in English and Spanish, and no empty text', () => {
    const english = new Map(leaves(en as Tree));
    const spanish = new Map(leaves(es as Tree));
    expect([...english.keys()].filter((k) => !spanish.has(k))).toEqual([]);
    expect([...spanish.keys()].filter((k) => !english.has(k))).toEqual([]);
    expect(
      [...english, ...spanish]
        .filter(([, text]) => text.trim() === '')
        .map(([k]) => k),
    ).toEqual([]);
  });

  it('use the same placeholders in both languages', () => {
    const spanish = new Map(leaves(es as Tree));
    const mismatches = leaves(en as Tree)
      .filter(
        ([key, text]) =>
          JSON.stringify(placeholders(text)) !==
          JSON.stringify(placeholders(spanish.get(key) ?? '')),
      )
      .map(([key]) => key);
    expect(mismatches).toEqual([]);
  });
});

describe('the language', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('is the remembered one, else the browser’s, else English', () => {
    localStorage.setItem('kf.locale', 'es');
    expect(detectLocale()).toBe('es');
    localStorage.clear();
    vi.stubGlobal('navigator', {language: 'es-CO'});
    expect(detectLocale()).toBe('es');
    vi.stubGlobal('navigator', {language: 'fr-FR'});
    expect(detectLocale()).toBe('en');
  });

  it('formats as en-US and es-CO', () => {
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('es')).toBe('es-CO');
  });
});
