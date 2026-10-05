import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import Select from 'react-select/creatable';

const emptyCustomer = { firstName: '', lastName: '', email: '', phone: '', addresses: [{ address: '', zipCode: '', city: { state: { country: {} } } }] };
const emptyInvoice = (suggestedCode, firstWarehouse) => ({
  code: suggestedCode || '',
  paymentMethod: '',
  customer: { ...emptyCustomer },
  customerAddress: '',
  taxRate: 0,
  warehouse: firstWarehouse || {},
  items: [],
  comment: '',
});

export default function ManageInvoice({ warehouses, customers: rawCustomers, locations, actionUrl, suggestedCode }) {
  const customers = rawCustomers.map(c => ({
    ...c,
    value: String(c.id),
    label: `${c.firstName} ${c.lastName} [${c.email}] [${c.phone}]`,
  }));

  const countries = (locations || []).map(c => ({ ...c, value: String(c.id), label: c.name }));

  const [invoice, setInvoice] = useState(() => emptyInvoice(suggestedCode, warehouses[0]));
  const [productsByWarehouse, setProductsByWarehouse] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [sending, setSending] = useState(false);

  const getProductsByWarehouse = (warehouseId) => {
    axios.get(Routing.generate('product_all', { warehouse: warehouseId }))
      .then(response => {
        setProductsByWarehouse(response.data.map(p => ({ ...p, value: p.id, label: `${p.title} (${p.code})` })));
      })
      .catch(() => setProductsByWarehouse([]));
  };

  useEffect(() => {
    if (warehouses.length > 0) {
      getProductsByWarehouse(warehouses[0].id);
    }
    setInvoice(prev => ({ ...prev, items: [...prev.items, { productId: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }] }));
  }, []);

  const filterStates = (countryId) => {
    if (!countryId) { setStates([]); return; }
    const country = (locations || []).find(l => Number(l.id) === Number(countryId));
    setStates(country ? country.states.map(s => ({ ...s, id: String(s.id) })) : []);
  };

  const filterCities = (stateId) => {
    if (!stateId) { setCities([]); return; }
    const state = states.find(s => Number(s.id) === Number(stateId));
    setCities(state ? state.cities : []);
  };

  const updateInvoice = (patch) => setInvoice(prev => ({ ...prev, ...patch }));
  const updateCustomer = (patch) => setInvoice(prev => ({ ...prev, customer: { ...prev.customer, ...patch } }));
  const updateAddress0 = (patch) => setInvoice(prev => {
    const addresses = [...prev.customer.addresses];
    addresses[0] = { ...addresses[0], ...patch };
    return { ...prev, customer: { ...prev.customer, addresses } };
  });

  const getCountry = () => {
    const a = invoice.customer.addresses[0];
    return a?.city?.state?.country?.name ? a.city.state.country : '';
  };

  const getState = () => {
    const a = invoice.customer.addresses[0];
    return a?.city?.state?.name ? a.city.state : '';
  };

  const getCity = () => {
    const a = invoice.customer.addresses[0];
    return a?.city?.name ? a.city : '';
  };

  const addEmptyItem = () =>
    updateInvoice({ items: [...invoice.items, { productId: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }] });

  const removeItem = (index) =>
    updateInvoice({ items: invoice.items.filter((_, i) => i !== index) });

  const addAllProducts = () => {
    const existingIds = invoice.items.map(i => String(i.productId));
    const newItems = productsByWarehouse
      .filter(p => !existingIds.includes(String(p.id)))
      .map(p => ({ productId: p.id, description: p.title || '', quantity: 1, unitPrice: p.price || 0, discount: 0 }));
    updateInvoice({ items: [...invoice.items, ...newItems] });
  };

  const onProductChange = (option, index) => {
    const product = productsByWarehouse.find(p => Number(p.id) === Number(option.value));
    const updatedItems = [...invoice.items];
    if (product) {
      updatedItems[index] = { ...updatedItems[index], productId: product.id, description: product.title || '', unitPrice: product.price || 0 };
    } else {
      updatedItems[index] = { ...updatedItems[index], productId: '', description: option?.label || '' };
    }
    updateInvoice({ items: updatedItems });
  };

  const updateItem = (index, patch) => {
    const updatedItems = [...invoice.items];
    updatedItems[index] = { ...updatedItems[index], ...patch };
    updateInvoice({ items: updatedItems });
  };

  const saveInvoice = () => {
    const filteredItems = invoice.items.filter(it =>
      (it.productId && String(it.productId).trim() !== '') || (it.description && String(it.description).trim() !== '')
    );

    if (filteredItems.length === 0) {
      alert('Please add at least one invoice item');
      return;
    }

    setSending(true);
    const payload = {
      code: invoice.code,
      paymentMethod: invoice.paymentMethod,
      customer: invoice.customer || null,
      taxRate: invoice.taxRate || 0,
      customerAddress: invoice.customerAddress || null,
      warehouse: invoice.warehouse?.id || null,
      comment: invoice.comment || '',
      items: filteredItems.map(it => ({ product: it.productId || null, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount })),
    };

    axios.post(actionUrl, payload)
      .then((response) => {
        setSending(false);
        if (response.data.status && response.data.invoice?.id) {
          window.open(Routing.generate('invoice_pdf', { invoice: response.data.invoice.id }), '_blank');
          window.location.href = Routing.generate('invoice_index');
        }
      })
      .catch(() => setSending(false));
  };

  const subtotal = invoice.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const taxAmount = +(subtotal * ((Number(invoice.taxRate) || 0) / 100));
  const total = subtotal + taxAmount;

  return (
    <div className="row">
      <div className="col-md-6">
        <h4>Customer</h4>
        <div className="form-group">
          <Select
            isClearable
            placeholder="Search customer"
            options={customers}
            value={customers.filter(c => c.id === invoice.customer?.id)}
            onChange={(selected) => {
              if (selected) {
                const addresses = Array.isArray(selected.addresses) && selected.addresses.length > 0
                  ? selected.addresses
                  : [{ address: selected.defaultAddress?.address || '', zipCode: selected.defaultAddress?.zipCode || '', city: selected.defaultAddress?.city || { state: { country: {} } } }];
                updateInvoice({ customer: { ...selected, addresses }, customerAddress: addresses[0]?.address || '' });
              } else {
                updateInvoice({ customer: { ...emptyCustomer }, customerAddress: '' });
              }
            }}
          />
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder="First Name" value={invoice.customer.firstName}
              onChange={e => updateCustomer({ firstName: e.target.value })} />
          </div>
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder="Last Name" value={invoice.customer.lastName}
              onChange={e => updateCustomer({ lastName: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder="Email" value={invoice.customer.email}
              onChange={e => updateCustomer({ email: e.target.value })} />
          </div>
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder="Phone" value={invoice.customer.phone}
              onChange={e => updateCustomer({ phone: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder="Address" value={invoice.customer.addresses[0].address}
              onChange={e => updateAddress0({ address: e.target.value })} />
          </div>
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder="Zip Code" value={invoice.customer.addresses[0].zipCode}
              onChange={e => updateAddress0({ zipCode: e.target.value })} />
          </div>
        </div>
        <div className="form-group form-row">
          <div className="col-4">
            <Select isClearable getOptionLabel={o => o.name} getOptionValue={o => o.id} value={getCountry()} options={countries}
              onChange={(country) => {
                const city = country
                  ? { ...invoice.customer.addresses[0].city, state: { ...invoice.customer.addresses[0].city.state, country: { id: country.id, name: country.name } } }
                  : { state: { country: {} } };
                updateAddress0({ city });
                filterStates(country?.id || null);
              }} />
          </div>
          <div className="col-4">
            <Select isClearable getOptionLabel={o => o.name} getOptionValue={o => o.id} value={getState()} options={states}
              onChange={(state) => {
                const city = state
                  ? { ...invoice.customer.addresses[0].city, state: { ...invoice.customer.addresses[0].city.state, id: state.id, name: state.name } }
                  : { state: { country: {} } };
                updateAddress0({ city });
                filterCities(state?.id || null);
              }} />
          </div>
          <div className="col-4">
            <Select isClearable getOptionLabel={o => o.name} getOptionValue={o => o.id} value={getCity()} options={cities}
              onChange={(city) => {
                updateAddress0({ city: city ? { ...invoice.customer.addresses[0].city, id: city.id, name: city.name } : { state: { country: {} } } });
              }} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="invoiceWarehouse">Warehouse</label>
          <select id="invoiceWarehouse" className="form-control" value={invoice.warehouse?.id || ''}
            onChange={e => {
              const wh = warehouses.find(w => Number(w.id) === Number(e.target.value));
              updateInvoice({ warehouse: wh || {} });
              if (e.target.value) getProductsByWarehouse(e.target.value);
            }}>
            <option value="">--</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="invoiceCode">Invoice #</label>
          <input id="invoiceCode" className="form-control" value={invoice.code} onChange={e => updateInvoice({ code: e.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="paymentMethod">Payment Method</label>
          <select id="paymentMethod" className="form-control" value={invoice.paymentMethod || ''} onChange={e => updateInvoice({ paymentMethod: e.target.value })}>
            <option value="">--</option>
            <option value="credit_counted">Credit - counted</option>
            <option value="credit_card">Credit card - Paypal</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="taxRate">Sale Tax</label>
          <select id="taxRate" className="form-control" value={invoice.taxRate || 0} onChange={e => updateInvoice({ taxRate: Number(e.target.value) })}>
            <option value={0}>0%</option>
            <option value={6}>6%</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="invoiceComment">Comments</label>
          <textarea id="invoiceComment" className="form-control" rows="3" value={invoice.comment || ''} onChange={e => updateInvoice({ comment: e.target.value })} />
        </div>
        <div className="form-group">
          <button className="btn btn-primary" disabled={sending} onClick={saveInvoice}>Create Invoice</button>
        </div>
      </div>

      <div className="col-md-6">
        <h4>Items</h4>
        <div className="mb-2 d-flex justify-content-between align-items-center">
          <strong>Product</strong>
          <div>
            <button className="btn btn-sm btn-secondary mr-2" onClick={addAllProducts}>Add all products</button>
            <button className="btn btn-sm btn-secondary" onClick={addEmptyItem}>Add item</button>
          </div>
        </div>
        <div className="mb-1 row font-weight-bold">
          <div className="col-md-5">Product / Description</div>
          <div className="col-md-2">Quantity</div>
          <div className="col-md-2">Unit Price</div>
          <div className="col-md-2">Total</div>
          <div className="col-md-1"> </div>
        </div>
        {invoice.items.map((it, idx) => (
          <div className="form-row mb-2" key={idx}>
            <div className="col-md-5">
              <Select options={productsByWarehouse} value={productsByWarehouse.filter(p => Number(p.id) === Number(it.productId))} onChange={option => onProductChange(option, idx)} />
            </div>
            <div className="col-md-2">
              <input className="form-control" type="number" value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} />
            </div>
            <div className="col-md-2">
              <input className="form-control" type="number" step="0.01" value={it.unitPrice} onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) })} />
            </div>
            <div className="col-md-2 d-flex align-items-center">
              {((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2)}
            </div>
            <div className="col-md-1">
              <button className="btn btn-danger" onClick={() => removeItem(idx)}>X</button>
            </div>
          </div>
        ))}
        <div className="mt-3">
          <div className="d-flex justify-content-end">
            <div className="text-right">
              <div><strong>Subtotal:</strong> {subtotal.toFixed(2)}</div>
              <div><strong>Tax ({invoice.taxRate}%):</strong> {taxAmount.toFixed(2)}</div>
              <div><strong>Total:</strong> {total.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ManageInvoice.defaultProps = {
  locations: [],
  suggestedCode: '',
};

ManageInvoice.propTypes = {
  warehouses: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  customers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  actionUrl: PropTypes.string.isRequired,
  locations: PropTypes.arrayOf(PropTypes.shape({})),
  suggestedCode: PropTypes.string,
};
