import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import Select from 'react-select/creatable';

const isValidNewOption = (inputValue, _value, selectOptions) => (
  !(inputValue.trim().length === 0 || selectOptions.find(option => option.name === inputValue))
);

const emptyOrder = {
  code: '',
  status: '',
  comment: '',
  paymentMethod: '',
  source: '',
  customer: { firstName: '', lastName: '', email: '', phone: '', addresses: [{ address: '', zipCode: '', city: { state: { country: {} } } }] },
  warehouse: {},
  products: [{ uuid: '', quantity: '' }],
};

const STATE_CREATING = 'new';
const STATE_EDITING = 'edit';

const isProductFilled = product => product.quantity !== '' && product.uuid !== '';

const ORDER_STATES = [1, 2, 3].map(id => ({ id, name: Translator.trans(`order_statuses.${id}`) }));
const ORDER_SOURCES = [1, 2].map(id => ({ id, name: Translator.trans(`order_source.${id}`) }));
const PAYMENT_METHODS = [1, 2].map(id => ({ id, name: Translator.trans(`paytment_methods.${id}`) }));

export default function ManageOrder({ locations, warehouses, customers: rawCustomers, order: rawOrder, actionUrl }) {
  const mode = Object.keys(rawOrder).length === 0 ? STATE_CREATING : STATE_EDITING;
  const initialOrder = mode === STATE_CREATING ? emptyOrder : rawOrder;

  const customers = rawCustomers.map(c => ({
    ...c,
    value: String(c.id),
    label: `${c.firstName} ${c.lastName} [${c.email}] [${c.phone}]`,
  }));

  const countries = locations.map(c => ({ ...c, value: String(c.id), label: c.name }));

  const [order, setOrder] = useState(initialOrder);
  const [productsByWarehouse, setProductsByWarehouse] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [sending, setSending] = useState(false);

  const getProductsByWarehouse = (warehouseId) => {
    axios.get(Routing.generate('product_all', { warehouse: warehouseId })).then((response) => {
      setProductsByWarehouse(response.data.map(p => ({ ...p, value: p.uuid, label: `${p.title} (${p.code})` })));
    });
  };

  useEffect(() => {
    if (mode === STATE_EDITING) {
      getProductsByWarehouse(initialOrder.warehouse.id);
    }
  }, []);

  const filterStates = (countryId) => {
    if (!countryId) { setStates([]); return; }
    const found = locations.find(l => Number(l.id) === Number(countryId));
    setStates(found ? found.states.map(s => ({ ...s, id: String(s.id) })) : []);
  };

  const filterCities = (stateId) => {
    if (!stateId) { setCities([]); return; }
    const state = states.find(s => Number(s.id) === Number(stateId));
    setCities(state ? state.cities : []);
  };

  const updateOrder = (patch) => setOrder(prev => ({ ...prev, ...patch }));

  const setProducts = (products) => updateOrder({ products });

  const getAddress0 = () => order.customer.addresses[0];

  const getCountry = () => {
    const a = getAddress0();
    return a?.city?.state?.country?.name ? a.city.state.country : '';
  };

  const getState = () => {
    const a = getAddress0();
    return a?.city?.state?.name ? a.city.state : '';
  };

  const getCity = () => {
    const a = getAddress0();
    return a?.city?.name ? a.city : '';
  };

  const getDefaultWarehouseId = () =>
    order.warehouse && Object.keys(order.warehouse).length > 0 ? order.warehouse.id : '';

  const setWarehouse = (warehouseId) => {
    const wh = warehouses.find(w => Number(w.id) === Number(warehouseId));
    updateOrder({ warehouse: wh });
    getProductsByWarehouse(warehouseId);
  };

  const isValid = () =>
    order.customer?.firstName && order.customer?.lastName && order.customer?.email
    && order.warehouse && Object.keys(order.warehouse).length > 0
    && order.products?.length > 0 && order.products.some(isProductFilled)
    && order.source && order.paymentMethod && order.status;

  const saveOrder = () => {
    setSending(true);
    axios.post(actionUrl, order).then((response) => {
      window.location.href = response.data.route;
    });
  };

  const { products, customer, code, paymentMethod, source, status } = order;

  return (
    <div className="row">
      <div className="col-sm-6">
        <h4>{Translator.trans('order.new.customer_information')}</h4>
        <div className="form-group">
          <Select
            isClearable
            placeholder={Translator.trans('order.new.search_customer')}
            options={customers}
            value={customers.filter(c => c.id === customer.id)}
            onChange={(selected) => {
              updateOrder({ customer: selected || emptyOrder.customer });
            }}
          />
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder={Translator.trans('order.new.first_name')} value={customer.firstName}
              onChange={e => setOrder(prev => ({ ...prev, customer: { ...prev.customer, firstName: e.target.value } }))} />
          </div>
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder={Translator.trans('order.new.last_name')} value={customer.lastName}
              onChange={e => setOrder(prev => ({ ...prev, customer: { ...prev.customer, lastName: e.target.value } }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder={Translator.trans('order.new.email')} value={customer.email}
              onChange={e => setOrder(prev => ({ ...prev, customer: { ...prev.customer, email: e.target.value } }))} />
          </div>
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder={Translator.trans('order.new.phone')} value={customer.phone}
              onChange={e => setOrder(prev => ({ ...prev, customer: { ...prev.customer, phone: e.target.value } }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder={Translator.trans('order.new.address')} value={getAddress0().address}
              onChange={e => setOrder(prev => {
                const addresses = [...prev.customer.addresses];
                addresses[0] = { ...addresses[0], address: e.target.value };
                return { ...prev, customer: { ...prev.customer, addresses } };
              })} />
          </div>
          <div className="form-group col-md-6">
            <input type="text" className="form-control" placeholder={Translator.trans('order.new.zip_code')} value={getAddress0().zipCode}
              onChange={e => setOrder(prev => {
                const addresses = [...prev.customer.addresses];
                addresses[0] = { ...addresses[0], zipCode: e.target.value };
                return { ...prev, customer: { ...prev.customer, addresses } };
              })} />
          </div>
        </div>
        <div className="form-group form-row">
          <div className="col-4">
            <Select
              isClearable
              getOptionLabel={o => o.name}
              getOptionValue={o => o.id}
              getNewOptionData={(v, l) => ({ id: null, name: l })}
              isValidNewOption={isValidNewOption}
              value={getCountry()}
              options={countries}
              onChange={(country) => {
                setOrder(prev => {
                  const addresses = [...prev.customer.addresses];
                  if (country) {
                    addresses[0] = { ...addresses[0], city: { ...addresses[0].city, state: { ...addresses[0].city.state, country: { id: country.id, name: country.name } } } };
                    filterStates(country.id);
                  } else {
                    addresses[0] = { ...addresses[0], city: { state: { country: {} } } };
                    filterStates(null);
                  }
                  return { ...prev, customer: { ...prev.customer, addresses } };
                });
              }}
            />
          </div>
          <div className="col-4">
            <Select
              isClearable
              getOptionLabel={o => o.name}
              getOptionValue={o => o.id}
              getNewOptionData={(v, l) => ({ id: null, name: l })}
              isValidNewOption={isValidNewOption}
              value={getState()}
              options={states}
              onChange={(state) => {
                setOrder(prev => {
                  const addresses = [...prev.customer.addresses];
                  if (state) {
                    addresses[0] = { ...addresses[0], city: { ...addresses[0].city, state: { ...addresses[0].city.state, id: state.id, name: state.name } } };
                    filterCities(state.id);
                  } else {
                    addresses[0] = { ...addresses[0], city: { state: { country: {} } } };
                    filterCities(null);
                  }
                  return { ...prev, customer: { ...prev.customer, addresses } };
                });
              }}
            />
          </div>
          <div className="col-4">
            <Select
              isClearable
              getOptionLabel={o => o.name}
              getOptionValue={o => o.id}
              getNewOptionData={(v, l) => ({ id: null, name: l })}
              isValidNewOption={isValidNewOption}
              value={getCity()}
              options={cities}
              onChange={(city) => {
                setOrder(prev => {
                  const addresses = [...prev.customer.addresses];
                  addresses[0] = city
                    ? { ...addresses[0], city: { ...addresses[0].city, id: city.id, name: city.name } }
                    : { ...addresses[0], city: { state: { country: {} } } };
                  return { ...prev, customer: { ...prev.customer, addresses } };
                });
              }}
            />
          </div>
        </div>
        <div className="form-group">
          <textarea className="form-control" placeholder={Translator.trans('order.new.comment')}
            onChange={e => updateOrder({ comment: e.target.value })} />
        </div>
      </div>

      <div className="col-sm-6">
        <h4>{Translator.trans('order.new.order_detail')}</h4>
        <div className="form-group">
          <div className="form-row">
            <div className="col-6">
              <select className="form-control" onChange={e => setWarehouse(e.target.value)} value={getDefaultWarehouseId()} disabled={products.some(isProductFilled)}>
                <option>{Translator.trans('order.new.select_warehouse')}</option>
                {warehouses.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="col-6">
              <select className="form-control" onChange={e => updateOrder({ paymentMethod: Number(e.target.value) })} value={paymentMethod}>
                <option>{Translator.trans('order.new.select_payment_methods')}</option>
                {PAYMENT_METHODS.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="form-group">
          <div className="form-row">
            <div className="col-4">
              <input type="text" className="form-control" value={code} placeholder={Translator.trans('order.new.consecutive')}
                onChange={e => updateOrder({ code: e.target.value })} />
            </div>
            <div className="col-4">
              <select className="form-control" onChange={e => updateOrder({ source: Number(e.target.value) })} value={source}>
                <option>{Translator.trans('order.new.select_source')}</option>
                {ORDER_SOURCES.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-4">
              <select className="form-control" onChange={e => updateOrder({ status: Number(e.target.value) })} value={status}>
                <option>{Translator.trans('order.new.select_status')}</option>
                {ORDER_STATES.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="col-sm-12 p-1">
          {products.map((product, index) => (
            <div className="form-group" key={index.toString()}>
              <div className="form-row">
                <div className="col-6">
                  <Select
                    options={productsByWarehouse}
                    value={productsByWarehouse.filter(p => p.uuid === product.uuid)}
                    onChange={(selected) => {
                      const updated = [...products];
                      updated[index] = { ...updated[index], uuid: selected.uuid };
                      setProducts(updated);
                    }}
                  />
                </div>
                <div className="col-3">
                  <input type="number" className="form-control" placeholder={Translator.trans('order.new.quantity')} value={product.quantity}
                    onChange={(e) => {
                      const updated = [...products];
                      updated[index] = { ...updated[index], quantity: e.target.value };
                      setProducts(updated);
                    }} />
                </div>
                <div className="col-2">
                  {(index + 1) === products.length && isProductFilled(product) && (
                    <button type="button" className="btn btn-success" onClick={() => setProducts([...products, { uuid: '', quantity: '' }])}>
                      <i className="fas fa-plus-circle" />
                    </button>
                  )}
                  {' '}
                  {products.length > 1 && (
                    <button type="button" className="btn btn-danger" onClick={() => setProducts(products.filter(p => p.uuid !== product.uuid))}>
                      <i className="fas fa-times-circle" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="col-sm-12">
          {isValid() && (
            <button type="button" className="btn btn-success" onClick={saveOrder} disabled={sending}>
              <i className="fas fa-save" />
              {mode === STATE_CREATING && ` ${Translator.trans('create')} `}
              {mode === STATE_EDITING && ` ${Translator.trans('update')} `}
              {sending && <i className="fas fa-spinner fa-pulse" />}
            </button>
          )}
          {' '}
          <a href={Routing.generate('order_index', null)} className="btn btn-danger" title={Translator.trans('cancel')}>
            <i className="fas fa-times-circle" />
            {` ${Translator.trans('cancel')} `}
          </a>
        </div>
      </div>
    </div>
  );
}

ManageOrder.propTypes = {
  locations: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  warehouses: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  customers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  order: PropTypes.shape({}).isRequired,
  actionUrl: PropTypes.string.isRequired,
};
