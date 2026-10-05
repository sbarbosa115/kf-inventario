import {translator} from '@/shared/i18n';
import {
  emptyProductForm,
  productFormToPayload,
  productToForm,
  validateProductForm,
  violationsToErrors,
} from './productForm';

const t = translator('en');

describe('the product form model', () => {
  it('starts a new product as active with every field empty', () => {
    expect(emptyProductForm()).toEqual({
      status: '1',
      code: '',
      title: '',
      detail: '',
      price: '',
    });
  });

  it('requires a code and a title, as the legacy form did', () => {
    const errors = validateProductForm(emptyProductForm(), t);

    expect(errors).toEqual({
      code: 'This value should not be blank.',
      title: 'This value should not be blank.',
    });
  });

  it('refuses the template placeholders as a code or a title (the spreadsheet header rows)', () => {
    for (const code of ['CODE', '·']) {
      expect(
        validateProductForm(
          {...emptyProductForm(), code, title: 'Chair'},
          t,
        ).code,
      ).toBe(`This value should not be equal to "${code}".`);
    }
    expect(
      validateProductForm(
        {...emptyProductForm(), code: 'KF-9', title: 'PRODUCT'},
        t,
      ).title,
    ).toBe('This value should not be equal to "PRODUCT".');
  });

  it('accepts an empty price but not a negative or a non-number one', () => {
    const base = {...emptyProductForm(), code: 'KF-9', title: 'Chair'};

    expect(validateProductForm(base, t)).toEqual({});
    expect(validateProductForm({...base, price: '-1'}, t).price).toBe(
      'This value should be either positive or zero.',
    );
    expect(validateProductForm({...base, price: 'abc'}, t).price).toBe(
      'This value should be a valid number.',
    );
  });

  it('sends the status and price as numbers, trimmed text, and blanks as null', () => {
    expect(
      productFormToPayload({
        status: '0',
        code: ' KF-9 ',
        title: ' Chair ',
        detail: '  ',
        price: '12.50',
      }),
    ).toEqual({
      code: 'KF-9',
      title: 'Chair',
      detail: null,
      status: 0,
      price: 12.5,
    });
    expect(
      productFormToPayload({...emptyProductForm(), code: 'A', title: 'B'})
        .price,
    ).toBeNull();
  });

  it('fills the form from a product', () => {
    expect(
      productToForm({
        id: 3,
        uuid: '00000000-0000-0000-0000-000000000003',
        code: 'KF-03',
        title: 'Table',
        detail: null,
        status: 0,
        price: 200,
        stock: [],
      }),
    ).toEqual({
      status: '0',
      code: 'KF-03',
      title: 'Table',
      detail: '',
      price: '200',
    });
  });

  it('puts the API violations on their fields', () => {
    expect(
      violationsToErrors({
        violations: [
          {field: 'code', message: 'Taken.'},
          {field: 'price', message: 'Bad price.'},
        ],
      }),
    ).toEqual({code: 'Taken.', price: 'Bad price.'});
  });
});
