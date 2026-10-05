import {formatter} from './format';

/** Intl puts (narrow) no-break spaces in money and times; compare with plain spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

describe('formatter', () => {
  const en = formatter('en');
  const es = formatter('es');

  it('writes money in US dollars by the language', () => {
    expect(plain(en.money(1250))).toBe('$1,250.00');
    expect(plain(es.money(1250))).toBe('US$ 1.250,00');
    expect(plain(en.money('100.00'))).toBe('$100.00');
    expect(plain(en.money(-3.5))).toBe('-$3.50');
  });

  it('writes numbers with the language’s separators', () => {
    expect(en.num(12345.5)).toBe('12,345.5');
    expect(plain(es.num(12345.5))).toBe('12.345,5');
    expect(en.num('7')).toBe('7');
  });

  it('writes dates and times in Bogotá time', () => {
    expect(plain(en.dateTime('2026-10-05T19:30:00+00:00'))).toBe(
      'Oct 5, 2026, 2:30 PM',
    );
    expect(plain(es.dateTime('2026-10-05T19:30:00+00:00'))).toBe(
      '5 de oct de 2026, 2:30 p. m.',
    );
    expect(en.date('2026-10-05T03:00:00+00:00')).toBe('Oct 4, 2026');
  });

  it('keeps a date without a time on its day', () => {
    expect(en.date('2026-10-05')).toBe('Oct 5, 2026');
  });

  it('answers an empty or unreadable value with a dash, not NaN', () => {
    expect(en.money(null)).toBe('—');
    expect(en.num('abc')).toBe('—');
    expect(en.date('')).toBe('—');
  });
});
