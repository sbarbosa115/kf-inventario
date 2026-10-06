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
    expect(prefetchRoute('/admin/settings')).toBe('settings');
    expect(prefetchRoute('/admin/settings/email')).toBe('settings');
    expect(prefetchRoute('/admin/settings/shops/new')).toBe(
      'shopConnectionForm',
    );
    expect(prefetchRoute('/admin/settings/shops/3')).toBe('shopConnectionForm');
    expect(prefetchRoute('/admin/settings/shops/3/deliveries')).toBe(
      'shopDeliveries',
    );
  });

  it('has nothing to fetch for sign-in or an unknown address', () => {
    expect(prefetchRoute('/admin/login')).toBeNull();
    expect(prefetchRoute('/admin/nothing-here')).toBeNull();
  });
});
