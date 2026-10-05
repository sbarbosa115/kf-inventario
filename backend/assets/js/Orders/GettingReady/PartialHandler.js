import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-bootstrap4-modal';
import axios from 'axios';
import PropTypes from 'prop-types';
import _ from 'lodash';

export default function PartialHandler({ order: initialOrder, partials: initialPartials, inventory }) {
  const [currentText, setCurrentText] = useState('');
  const [partials, setPartials] = useState([]);
  const [originalPartials] = useState(() => _.cloneDeep(initialPartials));
  const [sending, setSending] = useState(false);
  const [order] = useState(initialOrder);
  const [modalProductNotInOrder, setModalProductNotInOrder] = useState(false);
  const [modalProductLimitReached, setModalProductLimitReached] = useState(false);
  const [modalProductLimitInventoryReached, setModalProductLimitInventoryReached] = useState(false);
  const addProductTextRef = useRef(null);

  useEffect(() => {
    addProductTextRef.current?.focus();
  }, []);

  const getPartialQuantity = (uuid) =>
    originalPartials
      .filter(p => p.uuid.toLowerCase() === uuid.toLowerCase())
      .reduce((_, p) => p.quantity, 0);

  const getCurrentOrderProductQuantity = (uuid, currentPartials = partials) =>
    currentPartials
      .filter(p => p.uuid.toLowerCase() === uuid.toLowerCase())
      .reduce((_, p) => p.quantity, 0);

  const getProductQuantityOnInventory = (productCode) =>
    inventory
      .filter(p => p.product.code.toLowerCase() === productCode.toLowerCase())
      .reduce((_, p) => p.quantity, 0);

  const isThisProductOnOrder = (productCode) =>
    order.products.some(p => p.product.code.toLowerCase() === productCode.toLowerCase());

  const isAllowedToAddMoreProducts = (productCode) =>
    order.products
      .filter(p => p.product.code.toLowerCase() === productCode.toLowerCase())
      .reduce((_, p) => (
        (p.quantity - (getPartialQuantity(p.uuid) + getCurrentOrderProductQuantity(p.uuid))) > 0
      ), false);

  const getProductQuantityToDisplay = (product) => {
    const diff = product.quantity - (getPartialQuantity(product.uuid) + getCurrentOrderProductQuantity(product.uuid));
    return diff <= 0 ? '~' : diff;
  };

  const getBackgroundCell = (product) => {
    if (getProductQuantityToDisplay(product) === '~') return 'row-selected-completed';
    if (product.quantity === (product.quantity - (getPartialQuantity(product.uuid) + getCurrentOrderProductQuantity(product.uuid)))) {
      return 'row-selected-all-pending';
    }
    return 'row-selected-some-added';
  };

  const getReadyProductToOrder = (productCode) => {
    setPartials(prev => {
      const next = [...prev];
      const orderCloned = _.cloneDeep(order);
      const existIndex = next.findIndex(p => p.product.code.toLowerCase() === productCode.toLowerCase());

      if (existIndex === -1) {
        const newPartial = orderCloned.products
          .filter(p => p.product.code.toLowerCase() === productCode.toLowerCase())
          .map(p => { p.quantity = getCurrentOrderProductQuantity(p.uuid, next) + 1; return p; })
          .find(p => p);
        next.push(newPartial);
      } else {
        next[existIndex] = { ...next[existIndex], quantity: getCurrentOrderProductQuantity(next[existIndex].uuid, next) + 1 };
      }
      return next;
    });
    setCurrentText('');
  };

  const addProductHandler = (productCode) => {
    if (!isThisProductOnOrder(productCode)) {
      setModalProductNotInOrder(true);
    } else if (!getProductQuantityOnInventory(productCode) > 0) {
      setModalProductLimitInventoryReached(true);
    } else if (!isAllowedToAddMoreProducts(productCode)) {
      setModalProductLimitReached(true);
    } else {
      getReadyProductToOrder(productCode);
    }
  };

  const removeProductHandler = (productCode) => {
    setPartials(prev => {
      const index = prev.findIndex(p => p.product.code === productCode);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = { ...next[index], quantity: getCurrentOrderProductQuantity(next[index].uuid, next) - 1 };
      return next.filter(p => p.quantity !== 0);
    });
  };

  const sendRequest = () => {
    setSending(true);
    axios.post(Routing.generate('order_partial', { order: order.id }), partials)
      .then(() => { window.location.href = Routing.generate('order_index', null); });
  };

  const dismissModal = (setter) => {
    setter(false);
    setCurrentText('');
    addProductTextRef.current?.focus();
  };

  return (
    <div>
      <div className="row">
        <div className="col-md-12">
          <form>
            <p>{Translator.trans('order.getting_ready.description')}</p>
            <div className="form-inline">
              <input
                type="text"
                className="form-control form-control-sm my-1 mr-sm-2"
                placeholder={Translator.trans('order.getting_ready.bar_code')}
                value={currentText}
                onChange={e => setCurrentText(e.target.value)}
                onKeyPress={e => { if (e.key === 'Enter' && currentText) { addProductHandler(currentText); e.preventDefault(); } }}
                ref={addProductTextRef}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm my-2"
                onClick={() => { if (currentText) addProductHandler(currentText); }}
                disabled={currentText === ''}
              >
                {Translator.trans('order.getting_ready.add_action')}
              </button>
            </div>

            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{Translator.trans('order.getting_ready.code')}</th>
                  <th scope="col">{Translator.trans('order.getting_ready.product_description')}</th>
                  <th scope="col">{Translator.trans('order.getting_ready.inventory')}</th>
                  <th scope="col">{Translator.trans('order.getting_ready.order_quantity')}</th>
                  <th scope="col">{Translator.trans('order.getting_ready.order_left')}</th>
                  <th scope="col">{Translator.trans('order.getting_ready.this_order')}</th>
                  <th scope="col">{Translator.trans('order.getting_ready.options')}</th>
                </tr>
              </thead>
              <tbody>
                {order.products.map((product, productKey) => (
                  <tr key={`${product.product.uuid}-${product.product.code}`} className={getBackgroundCell(product)}>
                    <th scope="row">{productKey + 1}</th>
                    <td width="15%">{product.product.code}</td>
                    <td width="35%">{product.product.detail}</td>
                    <td width="5%" className="text-center">
                      <button className="btn btn-info btn-sm" type="button" title={Translator.trans('order.getting_ready.inventory_available')}>
                        {getProductQuantityOnInventory(product.product.code)}
                      </button>
                    </td>
                    <td width="15%" className="text-center">
                      {product.quantity}{' / '}{getProductQuantityToDisplay(product)}
                    </td>
                    <td className="text-center">{getPartialQuantity(product.uuid)}</td>
                    <td className="text-center">
                      <input type="number" className="form-control form-control-sm" readOnly value={getCurrentOrderProductQuantity(product.uuid)} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-danger"
                        onClick={() => removeProductHandler(product.product.code)}
                        disabled={getCurrentOrderProductQuantity(product.uuid) === 0}
                      >
                        <i className="fas fa-minus-circle" />
                      </button>
                      {' '}
                      <button type="button" className="btn btn-sm btn-success"
                        onClick={() => addProductHandler(product.product.code)}
                        disabled={getProductQuantityToDisplay(product) === '~'}
                      >
                        <i className="fas fa-plus-circle" />
                      </button>
                    </td>
                  </tr>
                ))}
                {order.products.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center">{Translator.trans('order.getting_ready.no_products')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="form-row">
              <div className="form-group col-md-6">
                <a className="btn btn-danger btn-block" href={Routing.generate('order_index', { order: order.id })}>
                  {Translator.trans('cancel')}
                </a>
              </div>
              <div className="form-group col-md-6">
                <button className="btn btn-success btn-block" type="button"
                  disabled={sending || order.status === 5 || order.status === 6}
                  onClick={sendRequest}
                >
                  {Translator.trans('order.getting_ready.add_partial')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {[
        { open: modalProductNotInOrder, setter: setModalProductNotInOrder, errorKey: 'order.getting_ready.modal_product_not_in_order.error', titleKey: 'order.getting_ready.modal_product_not_in_order.title', okKey: 'order.getting_ready.modal_product_not_in_order.action_ok' },
        { open: modalProductLimitReached, setter: setModalProductLimitReached, errorKey: 'order.getting_ready.modal_product_limit_reached.error', titleKey: 'order.getting_ready.modal_product_limit_reached.title', okKey: 'order.getting_ready.modal_product_limit_reached.action_ok' },
        { open: modalProductLimitInventoryReached, setter: setModalProductLimitInventoryReached, errorKey: 'order.getting_ready.modal_product_inventory_limit_reached.error', titleKey: 'order.getting_ready.modal_product_inventory_limit_reached.title', okKey: 'order.getting_ready.modal_product_inventory_limit_reached.action_ok' },
      ].map(({ open, setter, errorKey, titleKey, okKey }) => open && (
        <Modal visible key={errorKey}>
          <div className="modal-header">
            <h5 className="modal-title">{Translator.trans(errorKey)}</h5>
          </div>
          <div className="modal-body">
            <div className="row p-3">
              <h5 className="modal-title">{Translator.trans(titleKey)}</h5>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-success" onClick={() => dismissModal(setter)}>
              {Translator.trans(okKey)}
            </button>
          </div>
        </Modal>
      ))}
    </div>
  );
}

PartialHandler.propTypes = {
  partials: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  order: PropTypes.shape({}).isRequired,
  inventory: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
