import {translator} from '@/shared/i18n';
import {
  emptyInvoiceForm,
  emptyLine,
  invoiceFormToPayload,
  validateInvoiceForm,
} from './invoiceForm';

const t = translator('en');

describe('the invoice form model', () => {
  it('starts with the suggested code and one empty line', () => {
    const form = emptyInvoiceForm('20260001');

    expect(form).toMatchObject({code: '20260001', tax_rate: '0'});
    expect(form.lines).toHaveLength(1);
    expect(form.lines[0]).toMatchObject({product_id: null, description: ''});
  });

  it('needs at least one line with a product or a description', () => {
    expect(validateInvoiceForm(emptyInvoiceForm('1'), t).items).toBe(
      'Please add at least one invoice item.',
    );
    const form = emptyInvoiceForm('1');
    form.lines[0] = {...emptyLine(), description: 'Shipping'};
    expect(validateInvoiceForm(form, t)).toEqual({});
  });

  it('needs a code, a whole quantity and a price with at most two decimals', () => {
    const form = emptyInvoiceForm('');
    form.lines[0] = {
      ...emptyLine(),
      description: 'x',
      quantity: '0',
      unit_price: '1.234',
    };

    expect(validateInvoiceForm(form, t)).toEqual({
      code: 'This value should not be blank.',
      items: 'Every item needs a whole quantity and a price like 12.50.',
    });
  });

  it('sends only the filled lines, amounts as text, and the street of the first address', () => {
    const form = emptyInvoiceForm(' INV-1 ');
    form.tax_rate = '6';
    form.lines = [
      {
        ...emptyLine(),
        product_id: 5,
        description: 'Chair',
        unit_price: '9,5',
      },
      emptyLine(),
    ];

    const payload = invoiceFormToPayload(form, {
      id: 3,
      first_name: 'Ana',
      last_name: '',
      email: '',
      phone: '',
      addresses: [
        {
          id: null,
          address: '1 Main St',
          zip_code: '',
          address_type: null,
          city: {
            id: null,
            name: null,
            state: {id: null, name: null, country: {id: null, name: null}},
          },
        },
      ],
    });

    expect(payload).toMatchObject({
      code: 'INV-1',
      payment_method: null,
      tax_rate: '6',
      comment: null,
      customer_address: '1 Main St',
      items: [
        {
          product_id: 5,
          description: 'Chair',
          quantity: 1,
          unit_price: '9.5',
          discount: '0',
        },
      ],
    });
  });
});
