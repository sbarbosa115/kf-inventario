import {translator} from './i18n';
import en from './locales/en.json';

describe('translator', () => {
  it('fills the placeholders', () => {
    expect(translator('en')('common.pageOf', {page: 2, pages: 5})).toBe(
      'Page 2 of 5',
    );
  });

  it('shows a missing key instead of nothing, so a forgotten string is seen', () => {
    expect(translator('en')('nope.missing')).toBe('nope.missing');
  });

  it('keeps one empty section per item prefix, for the items to fill', () => {
    for (const prefix of [
      'users',
      'products',
      'stock',
      'customers',
      'address',
      'orders',
      'orderForm',
      'gettingReady',
      'invoices',
    ]) {
      expect(en).toHaveProperty(prefix);
    }
  });
});
