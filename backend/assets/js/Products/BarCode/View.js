import React, { useState, useEffect } from 'react';
import Modal from 'react-bootstrap4-modal';
import axios from 'axios';

export default function View() {
  const [currentText, setCurrentText] = useState('');
  const [products, setProducts] = useState([]);
  const [warehouse, setWarehouse] = useState(null);
  const [confirmAddProduct, setConfirmAddProduct] = useState(false);
  const [confirmRemoveProduct, setConfirmRemoveProduct] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    axios.get(Routing.generate('warehouse_all', null)).then(res => res.data).then((result) => {
      if (result.length <= 0) {
        throw new Error('The number of warehouses is 0, please add another Warehouse');
      }
      setWarehouses(result);
    });
  }, []);

  const updateRemoteStatus = (code, status) => {
    setProducts(prev => prev.map(p => p.code === code ? { ...p, exist: status } : p));
  };

  const addOrUpdateProduct = (code, quantity) => {
    setProducts(prev => {
      const index = prev.findIndex(p => p.code === code);
      if (index > -1) {
        const updated = [...prev];
        updated[index] = { ...updated[index], quantity: quantity !== undefined ? Number(quantity) : updated[index].quantity + 1 };
        return updated;
      }
      axios.get(Routing.generate('product_show', { code }))
        .then(() => updateRemoteStatus(code, true))
        .catch(() => updateRemoteStatus(code, false));
      return [...prev, { exist: 'loading', code, quantity: 1, key: `${prev.length - 1}-${code}` }];
    });
    setCurrentText('');
  };

  const addProduct = () => { if (currentText !== '') addOrUpdateProduct(currentText); };

  const removeProduct = (key) => setProducts(prev => prev.filter(item => item.key !== key));

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') { addProduct(); e.preventDefault(); }
  };

  const toAddRemoteProducts = () => {
    setSending(true);
    axios.post(Routing.generate('product_bar_code_add', { warehouse }), { data: products })
      .then(() => { setConfirmAddProduct(false); setSending(false); setProducts([]); });
  };

  const toRemoveRemoteProducts = () => {
    setSending(true);
    axios.post(Routing.generate('product_bar_code_remove', { warehouse }), { data: products })
      .then(() => { setConfirmRemoveProduct(false); setSending(false); setProducts([]); });
  };

  const confirmTable = (
    <table className="table table-sm">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">{Translator.trans('product.update.bar-code.code')}</th>
          <th scope="col">{Translator.trans('product.update.bar-code.quantity')}</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product, key) => (
          <tr key={product.code}>
            <td>{key + 1}</td>
            <td width="75%">{product.code}</td>
            <td>{product.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="row">
        <div className="col-md-12">
          <form>
            <p>{Translator.trans('product.update.bar-code.description')}</p>
            <div className="form-inline">
              <input
                type="text"
                className="form-control form-control-sm my-1 mr-sm-2"
                placeholder={Translator.trans('product.update.bar-code.bar_code')}
                value={currentText}
                onChange={e => setCurrentText(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button type="button" className="btn btn-primary btn-sm my-2" onClick={addProduct}>
                {Translator.trans('product.update.bar-code.add_action')}
              </button>
            </div>

            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{Translator.trans('product.update.bar-code.code')}</th>
                  <th scope="col">{Translator.trans('product.update.bar-code.quantity')}</th>
                  <th scope="col">{Translator.trans('product.update.bar-code.options')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item, key) => (
                  <tr key={item.key}>
                    <th scope="row">{key + 1}</th>
                    <td width="75%">{item.code}</td>
                    <td>
                      <input
                        type="text"
                        value={item.quantity}
                        data-code={item.code}
                        className="form-control form-control-sm"
                        onChange={e => addOrUpdateProduct(item.code, e.target.value)}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeProduct(item.key)}>
                        <i className="fas fa-trash-alt" />
                      </button>
                      {' '}
                      {item.exist === true && (
                        <button type="button" className="btn btn-sm btn-success" title={Translator.trans('product.update.bar-code.product_exist')}>
                          <i className="fas fa-check-circle" />
                        </button>
                      )}
                      {item.exist === false && (
                        <button type="button" className="btn btn-sm btn-danger" title={Translator.trans('product.update.bar-code.product_do_not_exist')}>
                          <i className="fas fa-times-circle" />
                        </button>
                      )}
                      {item.exist === 'loading' && (
                        <button type="button" className="btn btn-sm btn-info" title={Translator.trans('product.update.bar-code.loading')}>
                          <i className="fas fa-circle-notch fa-spin">{' '}</i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center">
                      {Translator.trans('product.update.bar-code.no_products')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="form-group">
              <label htmlFor="destinationWarehouse">{Translator.trans('product.update.bar-code.destination')}</label>
              <select className="form-control form-control-sm" onChange={e => setWarehouse(e.target.value)}>
                <option key={0} defaultValue>{Translator.trans('product.update.bar-code.select_some_warehouse')}</option>
                {warehouses.map(item => (
                  <option value={item.id} key={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            <div className="form-inline">
              {warehouse === null || products.length === 0 ? (
                <div>
                  <button type="button" className="btn btn-primary my-2 disabled">{Translator.trans('product.update.bar-code.add_products')}</button>
                  {' '}
                  <button type="button" className="btn btn-danger my-2 disabled">{Translator.trans('product.update.bar-code.remove_products')}</button>
                </div>
              ) : (
                <div>
                  <button type="button" className="btn btn-primary my-2" onClick={() => setConfirmAddProduct(true)}>{Translator.trans('product.update.bar-code.add_products')}</button>
                  {' '}
                  <button type="button" className="btn btn-danger my-2" onClick={() => setConfirmRemoveProduct(true)}>{Translator.trans('product.update.bar-code.remove_products')}</button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {confirmAddProduct && (
        <Modal visible dialogClassName="modal-lg">
          <div className="modal-header">
            <h5 className="modal-title">{Translator.trans('product.update.bar-code.confirm.title')}</h5>
          </div>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-12">
                {Translator.trans('product.update.bar-code.confirm.body', { warehouse })}
                <hr />
                {confirmTable}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-danger" onClick={() => setConfirmAddProduct(false)}>
              {Translator.trans('cancel')}
            </button>
            {sending ? (
              <button type="button" className="btn btn-primary disabled">
                {Translator.trans('product.update.bar-code.confirm.action_doing')}
                {' '}<i className="fas fa-sync fa-spin">{' '}</i>
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={toAddRemoteProducts}>
                {Translator.trans('product.update.bar-code.confirm.action')}
              </button>
            )}
          </div>
        </Modal>
      )}

      {confirmRemoveProduct && (
        <Modal visible dialogClassName="modal-lg">
          <div className="modal-header">
            <h5 className="modal-title">{Translator.trans('product.update.bar-code.confirm.title')}</h5>
          </div>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-12">
                {Translator.trans('product.update.bar-code.confirm.body', { warehouse })}
                <hr />
                {confirmTable}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-danger" onClick={() => setConfirmRemoveProduct(false)}>
              {Translator.trans('cancel')}
            </button>
            {sending ? (
              <button type="button" className="btn btn-primary disabled">
                {Translator.trans('product.update.bar-code.confirm.action_doing')}
                {' '}<i className="fas fa-sync fa-spin">{' '}</i>
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={toRemoveRemoteProducts}>
                {Translator.trans('product.update.bar-code.confirm.remove_quantity')}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
