import {prefetchRoute} from './routes';

describe('prefetchRoute', () => {
  it('names the page chunk an address opens', () => {
    expect(prefetchRoute('/admin/products')).toBe('products');
    expect(prefetchRoute('/admin/products/abc-123/edit')).toBe('productForm');
    expect(prefetchRoute('/admin/products/barcode')).toBe('barcodeReader');
    expect(prefetchRoute('/admin/orders/4/getting-ready')).toBe(
      'orderGettingReady',
    );
    expect(prefetchRoute('/admin/orders')).toBe('orders');
    expect(prefetchRoute('/')).toBe('products');
  });

  it('has nothing to fetch for sign-in or an unknown address', () => {
    expect(prefetchRoute('/admin/login')).toBeNull();
    expect(prefetchRoute('/admin/nothing-here')).toBeNull();
  });
});
