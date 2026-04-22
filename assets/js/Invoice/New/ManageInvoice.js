import React, { Component } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import Select from 'react-select/creatable';

class ManageInvoice extends Component {
  constructor(props) {
    super(props);

    const customers = props.customers.map((customer) => {
      customer.value = (customer.id).toString();
      customer.label = `${customer.firstName} ${customer.lastName} [${customer.email}] [${customer.phone}]`;
      return customer;
    });

    const countries = (props.locations || []).map((country) => {
      country.value = (country.id).toString();
      country.label = country.name;
      return country;
    });

    this.state = {
      warehouses: props.warehouses,
      customers,
      productsByWarehouse: [],
      countries,
      states: [],
      cities: [],
      invoice: {
        code: props.suggestedCode || '',
        paymentMethod: '',
        customer: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          addresses: [
            {
              address: '',
              zipCode: '',
              city: { state: { country: {} } },
            },
          ],
        },
        customerAddress: '',
        taxRate: 0,
        warehouse: {},
        items: [],
        comment: '',
      },
      actionUrl: props.actionUrl,
      sending: false,
    };

    this.addEmptyItem = this.addEmptyItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.setWarehouseHandler = this.setWarehouseHandler.bind(this);
    this.addAllProducts = this.addAllProducts.bind(this);
    this.saveInvoice = this.saveInvoice.bind(this);
  }

  componentDidMount() {
    const { warehouses } = this.state;
    if (warehouses && warehouses.length > 0) {
      this.getProductsByWarehouse(warehouses[0].id);
      const invoice = this.state.invoice;
      invoice.warehouse = warehouses[0];
      this.setState({ invoice });
    }
    this.addEmptyItem();
  }

  getCountry() {
    const { invoice } = this.state;
    const { customer } = invoice;
    if (customer.addresses && customer.addresses.length > 0
      && customer.addresses[0].city
      && customer.addresses[0].city.state
      && customer.addresses[0].city.state.country
      && customer.addresses[0].city.state.country.name
    ) {
      return customer.addresses[0].city.state.country;
    }
    return '';
  }

  getState() {
    const { invoice } = this.state;
    const { customer } = invoice;
    if (customer.addresses && customer.addresses.length > 0
      && customer.addresses[0].city
      && customer.addresses[0].city.state
      && customer.addresses[0].city.state.name
    ) {
      return customer.addresses[0].city.state;
    }
    return '';
  }

  getCity() {
    const { invoice } = this.state;
    const { customer } = invoice;
    if (customer.addresses && customer.addresses.length > 0
      && customer.addresses[0].city
      && customer.addresses[0].city.name
    ) {
      return customer.addresses[0].city;
    }
    return '';
  }

  filterStates(countryId) {
    const states = [];
    if (countryId) {
      const { locations } = this.props;
      locations.forEach((locationItem) => {
        if (Number(locationItem.id) === Number(countryId)) {
          locationItem.states.forEach((state) => {
            states.push({
              cities: state.cities,
              name: state.name,
              id: (state.id).toString(),
            });
          });
        }
      });
    }

    this.setState({ states });
  }

  filterCities(stateId) {
    let cities = [];
    if (stateId) {
      const { states } = this.state;
      const state = states.find(stateItem => (Number(stateItem.id) === Number(stateId)));
      ({ cities } = state);
    }
    this.setState({ cities });
  }

  getProductsByWarehouse(warehouseId) {
    axios.get(Routing.generate('product_all', { warehouse: warehouseId }))
      .then((response) => {
        const productsByWarehouse = response.data.map((product) => {
          product.value = product.id;
          product.label = `${product.title} (${product.code})`;
          return product;
        });
        this.setState({ productsByWarehouse });
      }).catch(() => this.setState({ productsByWarehouse: [] }));
  }

  setWarehouseHandler(e) {
    const warehouseId = e.target.value;
    const { warehouses, invoice } = this.state;
    const warehouse = warehouses.find(w => Number(w.id) === Number(warehouseId));
    invoice.warehouse = warehouse || {};
    this.setState({ invoice });
    if (warehouseId) {
      this.getProductsByWarehouse(warehouseId);
    }
  }

  addEmptyItem() {
    const { invoice } = this.state;
    invoice.items.push({ productId: '', description: '', quantity: 1, unitPrice: 0, discount: 0 });
    this.setState({ invoice });
  }

  addAllProducts() {
    const { invoice, productsByWarehouse } = this.state;
    const existingIds = invoice.items.map(i => String(i.productId));
    productsByWarehouse.forEach((p) => {
      if (!existingIds.includes(String(p.id))) {
        invoice.items.push({ productId: p.id, description: p.title || p.label || '', quantity: 1, unitPrice: p.price || p.unitPrice || 0, discount: 0 });
      }
    });
    this.setState({ invoice });
  }

  removeItem(index) {
    const { invoice } = this.state;
    invoice.items = invoice.items.filter((_, i) => i !== index);
    this.setState({ invoice });
  }

  onProductChange(option, index) {
    const { invoice, productsByWarehouse } = this.state;
    const product = productsByWarehouse.find(p => Number(p.id) === Number(option.value));
    if (product) {
      invoice.items[index].productId = product.id;
      invoice.items[index].description = product.title || '';
      invoice.items[index].unitPrice = product.price || 0;
    } else {
      invoice.items[index].productId = '';
      invoice.items[index].description = option ? option.name || option.label || '' : '';
    }
    this.setState({ invoice });
  }

  saveInvoice() {
    const { invoice, actionUrl } = this.state;
    this.setState({ sending: true });
    // filter out empty placeholder items (no product id and no description)
    const filteredItems = (invoice.items || []).filter(it => (
      (it.productId && String(it.productId).trim() !== '') || (it.description && String(it.description).trim() !== '')
    ));

    if (filteredItems.length === 0) {
      this.setState({ sending: false });
      alert('Please add at least one invoice item');
      return;
    }

    const payload = {
      code: invoice.code,
      paymentMethod: invoice.paymentMethod,
      // send full customer object so backend can create/update if needed
      customer: invoice.customer || null,
      taxRate: invoice.taxRate || 0,
      customerAddress: invoice.customerAddress || null,
      warehouse: invoice.warehouse.id || null,
      comment: invoice.comment || '',
      items: filteredItems.map((it) => ({ product: it.productId || null, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount })),
    };

    axios.post(actionUrl, payload).then((response) => {
      this.setState({ sending: false });
      if (response.data.status && response.data.invoice && response.data.invoice.id) {
        const pdfUrl = Routing.generate('invoice_pdf', { invoice: response.data.invoice.id });
        window.open(pdfUrl, '_blank');
        // redirect current window to invoice index
        window.location.href = Routing.generate('invoice_index');
      } else {
        console.log(response.data);
      }
    }).catch((err) => {
      this.setState({ sending: false });
      console.error(err);
    });
  }

  render() {
    const { warehouses, customers, productsByWarehouse, invoice, sending } = this.state;

    return (
      <div className="row">
        <div className="col-md-6">
          <h4>Customer</h4>
          <div className="form-group">
            <Select
              isClearable
              placeholder="Search customer"
              options={customers}
              value={customers.filter(c => c.id === (invoice.customer && invoice.customer.id))}
              onChange={(selected) => {
                    invoice.customer = selected || { firstName: '', lastName: '', email: '', phone: '', addresses: [{ address: '', zipCode: '', city: { state: { country: {} } } }] };
                    // populate main address fields into structured addresses if available
                    // populate main address fields into structured addresses if available
                    if (selected) {
                      if (selected.defaultAddress) {
                        invoice.customer.addresses = [ {
                          address: selected.defaultAddress.address || selected.defaultAddress.address1 || '',
                          zipCode: selected.defaultAddress.zipCode || '',
                          city: selected.defaultAddress.city || { state: { country: {} } },
                        } ];
                      } else if (Array.isArray(selected.addresses) && selected.addresses.length>0) {
                        invoice.customer.addresses = selected.addresses;
                      }
                    }
                    // address fallback for free text field
                    let addr = '';
                    if (selected && selected.defaultAddress && (selected.defaultAddress.address || selected.defaultAddress.address1)) {
                      addr = selected.defaultAddress.address || selected.defaultAddress.address1 || '';
                    } else if (selected && Array.isArray(selected.addresses) && selected.addresses.length>0) {
                      addr = selected.addresses[0].address || '';
                    }
                    invoice.customerAddress = addr;
                    this.setState({ invoice });
              }}
            />
          </div>

          <div className="form-row">
            <div className="form-group col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="First Name"
                value={invoice.customer.firstName}
                onChange={(e) => { invoice.customer.firstName = e.target.value; this.setState({ invoice }); }}
              />
            </div>
            <div className="form-group col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Last Name"
                value={invoice.customer.lastName}
                onChange={(e) => { invoice.customer.lastName = e.target.value; this.setState({ invoice }); }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Email"
                value={invoice.customer.email}
                onChange={(e) => { invoice.customer.email = e.target.value; this.setState({ invoice }); }}
              />
            </div>
            <div className="form-group col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Phone"
                value={invoice.customer.phone}
                onChange={(e) => { invoice.customer.phone = e.target.value; this.setState({ invoice }); }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Address"
                value={invoice.customer.addresses[0].address}
                onChange={(e) => { invoice.customer.addresses[0].address = e.target.value; this.setState({ invoice }); }}
              />
            </div>
            <div className="form-group col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Zip Code"
                value={invoice.customer.addresses[0].zipCode}
                onChange={(e) => { invoice.customer.addresses[0].zipCode = e.target.value; this.setState({ invoice }); }}
              />
            </div>
          </div>

          <div className="form-group form-row">
            <div className="col-4">
              <Select
                isClearable
                getOptionLabel={option => option.name}
                getOptionValue={option => option.id}
                value={this.getCountry()}
                options={this.state.countries}
                onChange={(country) => {
                  if (country !== null) {
                    invoice.customer.addresses[0].city.state.country.id = country.id;
                    invoice.customer.addresses[0].city.state.country.name = country.name;
                    this.filterStates(country.id);
                  } else {
                    invoice.customer.addresses[0].city.state.country = { };
                    this.filterStates(null);
                  }
                  this.setState({ invoice });
                }}
              />
            </div>
            <div className="col-4">
              <Select
                isClearable
                getOptionLabel={option => option.name}
                getOptionValue={option => option.id}
                value={this.getState()}
                options={this.state.states}
                onChange={(stateSel) => {
                  if (stateSel !== null) {
                    invoice.customer.addresses[0].city.state.id = stateSel.id;
                    invoice.customer.addresses[0].city.state.name = stateSel.name;
                    this.filterCities(stateSel.id);
                  } else {
                    invoice.customer.addresses[0].city.state = { country: {} };
                    this.filterCities(null);
                  }
                  this.setState({ invoice });
                }}
              />
            </div>
            <div className="col-4">
              <Select
                isClearable
                getOptionLabel={option => option.name}
                getOptionValue={option => option.id}
                value={this.getCity()}
                options={this.state.cities}
                onChange={(city) => {
                  if (city !== null) {
                    invoice.customer.addresses[0].city.id = city.id;
                    invoice.customer.addresses[0].city.name = city.name;
                  } else {
                    invoice.customer.addresses[0].city = { state: { country: {} } };
                  }
                  this.setState({ invoice });
                }}
              />
            </div>
          </div>

          {/* CC / NIT field removed */}

          <div className="form-group">
            <label>Warehouse</label>
            <select className="form-control" value={invoice.warehouse.id || ''} onChange={e => this.setWarehouseHandler(e)}>
              <option value="">--</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Invoice #</label>
            <input className="form-control" value={invoice.code} onChange={e => { invoice.code = e.target.value; this.setState({ invoice }); }} />
          </div>

          <div className="form-group">
            <label>Payment Method</label>
            <select className="form-control" value={invoice.paymentMethod || ''} onChange={e => { invoice.paymentMethod = e.target.value; this.setState({ invoice }); }}>
              <option value="">--</option>
              <option value="credit_counted">Credit - counted</option>
              <option value="credit_card">Credit card - Paypal</option>
            </select>
          </div>

          <div className="form-group">
            <label>Sale Tax</label>
            <select className="form-control" value={invoice.taxRate || 0} onChange={e => { invoice.taxRate = Number(e.target.value); this.setState({ invoice }); }}>
              <option value={0}>0%</option>
              <option value={6}>6%</option>
            </select>
          </div>

          <div className="form-group">
            <label>Comments</label>
            <textarea className="form-control" rows="3" value={invoice.comment || ''} onChange={e => { invoice.comment = e.target.value; this.setState({ invoice }); }} />
          </div>

          <div className="form-group">
            <button className="btn btn-primary" disabled={sending} onClick={this.saveInvoice}>Create Invoice</button>
          </div>
        </div>

        <div className="col-md-6">
          <h4>Items</h4>
          <div className="mb-2 d-flex justify-content-between align-items-center">
            <div>
              <strong>Product</strong>
            </div>
            <div className="text-right">
              <button className="btn btn-sm btn-secondary mr-2" onClick={this.addAllProducts}>Add all products</button>
              <button className="btn btn-sm btn-secondary" onClick={this.addEmptyItem}>Add item</button>
            </div>
          </div>
          <div className="mb-1 row font-weight-bold">
            <div className="col-md-5">Product / Description</div>
            <div className="col-md-2">Quantity</div>
            <div className="col-md-2">Unit Price</div>
            <div className="col-md-2">Total</div>
            <div className="col-md-1"> </div>
          </div>
          {invoice.items.map((it, idx) => {
            const qty = Number(it.quantity) || 0;
            const up = Number(it.unitPrice) || 0;
            const lineTotal = (qty * up).toFixed(2);
            return (
              <div className="form-row mb-2" key={idx}>
                <div className="col-md-5">
                  <Select
                    options={productsByWarehouse}
                    value={productsByWarehouse.filter(p => Number(p.id) === Number(it.productId))}
                    onChange={(option) => this.onProductChange(option, idx)}
                  />
                </div>
                <div className="col-md-2">
                  <input className="form-control" type="number" value={it.quantity} onChange={e => { invoice.items[idx].quantity = Number(e.target.value); this.setState({ invoice }); }} />
                </div>
                <div className="col-md-2">
                  <input className="form-control" type="number" step="0.01" value={it.unitPrice} onChange={e => { invoice.items[idx].unitPrice = parseFloat(e.target.value); this.setState({ invoice }); }} />
                </div>
                <div className="col-md-2 d-flex align-items-center">
                  <div>{lineTotal}</div>
                </div>
                <div className="col-md-1">
                  <button className="btn btn-danger" onClick={() => this.removeItem(idx)}>X</button>
                </div>
              </div>
            );
          })}

          <div className="mt-3">
            <div className="d-flex justify-content-end">
              <div className="text-right">
                {(() => {
                  const subtotal = invoice.items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);
                  const taxRate = Number(invoice.taxRate) || 0;
                  const taxAmount = +(subtotal * (taxRate / 100));
                  const total = subtotal + taxAmount;
                  return (
                    <div>
                      <div><strong>Subtotal:</strong> {subtotal.toFixed(2)}</div>
                      <div><strong>Tax ({taxRate}%):</strong> {taxAmount.toFixed(2)}</div>
                      <div><strong>Total:</strong> {total.toFixed(2)}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

ManageInvoice.propTypes = {
  warehouses: PropTypes.array.isRequired,
  customers: PropTypes.array.isRequired,
  actionUrl: PropTypes.string.isRequired,
  locations: PropTypes.array,
  suggestedCode: PropTypes.string,
};

export default ManageInvoice;
