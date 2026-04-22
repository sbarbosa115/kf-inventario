import React, { Component } from 'react';
import Modal from 'react-bootstrap4-modal';
import axios from 'axios';

class View extends Component {
  constructor(props) {
    super(props);

    this.state = {
      currentText: '',
      products: [],
      warehouse: null,
      confirmAddProduct: false,
      confirmRemoveProduct: false,
      warehouses: [],
      sending: false,
    };
    this.removeProduct = this.removeProduct.bind(this);
    this.addProduct = this.addProduct.bind(this);
    this.handleWarehouse = this.handleWarehouse.bind(this);
    this.toAddRemoteProducts = this.toAddRemoteProducts.bind(this);
    this.toRemoveRemoteProducts = this.toRemoveRemoteProducts.bind(this);
    this.addOrUpdateProduct = this.addOrUpdateProduct.bind(this);
    this.updateProduct = this.updateProduct.bind(this);
    this.updateRemoteStatus = this.updateRemoteStatus.bind(this);
  }

  componentDidMount() {
    axios.get(Routing.generate('warehouse_all', null)).then(res => res.data).then(
      (result) => {
        if (result.length <= 0) {
          throw new Error('The number of warehouses is 0, please add another Warehouse');
        }
        this.setState({
          warehouses: result,
        });
      },
    );
  }

  handleWarehouse(e) {
    this.setState({
      warehouse: e.target.value,
    });
  }

  addProduct() {
    const { currentText } = this.state;
    if (currentText !== '') {
      this.addOrUpdateProduct(currentText);
    }
  }

  addOrUpdateProduct(currentCode, quantity) {
    const { products } = this.state;
    const productExistIndex = products.findIndex(product => (product.code === currentCode));
    if (productExistIndex > -1) {
      let newQuantity = products[productExistIndex].quantity + 1;
      if (quantity !== undefined) {
        newQuantity = Number(quantity);
      }
      products[productExistIndex].quantity = newQuantity;
    } else {
      axios.get(Routing.generate('product_show', { code: currentCode })).then(res => res.data).then(
        () => {
          this.updateRemoteStatus(currentCode, true);
        },
        () => {
          this.updateRemoteStatus(currentCode, false);
        },
      );

      products.push({
        exist: 'loading',
        code: currentCode,
        quantity: 1,
        key: `${products.length - 1}-${currentCode}`,
      });
    }
    this.setState({ products, currentText: '' });
  }

  updateRemoteStatus(currentCode, status) {
    const { products } = this.state;
    const productExistIndex = products.findIndex(product => (product.code === currentCode));
    if (productExistIndex > -1) {
      products[productExistIndex].exist = status;
    }
    this.setState({ products });
  }

  removeProduct(key) {
    const { products } = this.state;
    const filtered = products.filter(item => (
      item.key !== key
    ));
    this.setState({
      products: filtered,
    });
  }

  currentText(e) {
    this.setState({
      currentText: e.target.value,
    });
  }

  addProductKeyPressHandler(e) {
    if (e.key === 'Enter') {
      this.addProduct();
      e.preventDefault();
    }
  }

  toAddRemoteProducts() {
    const { products, warehouse } = this.state;
    this.setState({
      sending: true,
    });
    axios.post(Routing.generate('product_bar_code_add', { warehouse }), {
      data: products,
    }).then(res => res.data).then(() => {
      this.setState({
        confirmAddProduct: false,
        sending: false,
        products: [],
      });
    });
  }

  toRemoveRemoteProducts() {
    const { products, warehouse } = this.state;
    this.setState({
      sending: true,
    });
    axios.post(Routing.generate('product_bar_code_remove', { warehouse }), {
      data: products,
    }).then(res => res.data).then(() => {
      this.setState({
        confirmRemoveProduct: false,
        sending: false,
        products: [],
      });
    });
  }

  addProductFocus(input) {
    input.focus();
  }

  updateProduct(e) {
    this.addOrUpdateProduct(e.target.getAttribute('data-code'), Number(e.target.value));
  }

  render() {
    const {
      products, currentText, warehouse, confirmAddProduct,
      confirmRemoveProduct, warehouses, sending,
    } = this.state;
    return (
      <div>
        <div className="row">
          <div className="col-md-12">
            <form>
              <p>
                {Translator.trans('product.update.bar-code.description')}
              </p>
              <div className="form-inline">
                <input
                  type="text"
                  className="form-control form-control-sm my-1 mr-sm-2"
                  placeholder={Translator.trans('product.update.bar-code.bar_code')}
                  value={currentText}
                  onChange={e => this.currentText(e)}
                  onKeyPress={e => this.addProductKeyPressHandler(e)}
                  ref={this.addProductFocus}
                />
                <button type="button" className="btn btn-primary btn-sm my-2" onClick={this.addProduct}>
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
                      <td width="75%">
                        {item.code}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.quantity}
                          data-code={item.code}
                          className="form-control form-control-sm"
                          onChange={this.updateProduct}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => this.removeProduct(item.key)}
                          data-toggle="tooltip"
                          data-placement="top"
                          title={Translator.trans('product.update.bar-code.remove_product')}
                        >
                          <i className="fas fa-trash-alt" />
                        </button>
                        { ' ' }
                        { item.exist === true
                        && (
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          data-toggle="tooltip"
                          data-placement="top"
                          title={Translator.trans('product.update.bar-code.product_exist')}
                        >
                          <i className="fas fa-check-circle" />
                        </button>
                        )
                        }
                        { item.exist === false
                        && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            data-toggle="tooltip"
                            data-placement="top"
                            title={Translator.trans('product.update.bar-code.product_do_not_exist')}
                          >
                            <i className="fas fa-times-circle" />
                          </button>
                        )
                        }
                        { item.exist === 'loading'
                        && (
                          <button
                            type="button"
                            className="btn btn-sm btn-info"
                            data-toggle="tooltip"
                            data-placement="top"
                            title={Translator.trans('product.update.bar-code.loading')}
                          >
                            <i className="fas fa-circle-notch fa-spin">{ ' ' }</i>
                          </button>
                        )
                        }
                      </td>
                    </tr>
                  ))}
                  { products.length === 0
                  && (
                    <tr>
                      <td colSpan="4" className="text-center">
                        {Translator.trans('product.update.bar-code.no_products')}
                      </td>
                    </tr>
                  )
                }
                </tbody>
              </table>

              <div className="form-group">
                <label htmlFor="destinationWarehouse">{Translator.trans('product.update.bar-code.destination')}</label>
                <select className="form-control form-control-sm" onChange={this.handleWarehouse}>
                  <option key={0} defaultValue>{Translator.trans('product.update.bar-code.select_some_warehouse')}</option>
                  {warehouses.map(item => (
                    <option value={item.id} key={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-inline">
                {warehouse === null || products.length === 0 ? (
                  <div>
                    <button type="button" className="btn btn-primary my-2 disabled">
                      {Translator.trans('product.update.bar-code.add_products')}
                    </button>
                    { ' ' }
                    <button type="button" className="btn btn-danger my-2 disabled">
                      {Translator.trans('product.update.bar-code.remove_products')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button type="button" className="btn btn-primary my-2" onClick={() => (this.setState({ confirmAddProduct: true }))}>
                      {Translator.trans('product.update.bar-code.add_products')}
                    </button>
                    { ' ' }
                    <button type="button" className="btn btn-danger my-2" onClick={() => (this.setState({ confirmRemoveProduct: true }))}>
                      {Translator.trans('product.update.bar-code.remove_products')}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {confirmAddProduct && (
          <Modal visible onClickBackdrop={this.modalBackdropClicked} dialogClassName="modal-lg">
            <div className="modal-header">
              <h5 className="modal-title">{Translator.trans('product.update.bar-code.confirm.title')}</h5>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-12">
                  {Translator.trans('product.update.bar-code.confirm.body', { warehouse })}
                  <hr />
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
                          <td>
                            {key + 1}
                          </td>
                          <td width="75%">
                            {product.code}
                          </td>
                          <td>
                            {product.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-danger" onClick={() => (this.setState({ confirmAddProduct: false }))}>
                {Translator.trans('cancel')}
              </button>
              {sending ? (
                <button type="button" className="btn btn-primary disabled">
                  {Translator.trans('product.update.bar-code.confirm.action_doing')}
                  {' '}
                  <i className="fas fa-sync fa-spin">{' '}</i>
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={this.toAddRemoteProducts}>
                  {Translator.trans('product.update.bar-code.confirm.action')}
                </button>
              )}
            </div>
          </Modal>
        )}
        {confirmRemoveProduct && (
          <Modal visible onClickBackdrop={this.modalBackdropClicked} dialogClassName="modal-lg">
            <div className="modal-header">
              <h5 className="modal-title">{Translator.trans('product.update.bar-code.confirm.title')}</h5>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-12">
                  {Translator.trans('product.update.bar-code.confirm.body', { warehouse })}
                  <hr />
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
                          <td>
                            {key + 1}
                          </td>
                          <td width="75%">
                            {product.code}
                          </td>
                          <td>
                            {product.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-danger" onClick={() => (this.setState({ confirmRemoveProduct: false }))}>
                {Translator.trans('cancel')}
              </button>
              {sending ? (
                <button type="button" className="btn btn-primary disabled">
                  {Translator.trans('product.update.bar-code.confirm.action_doing')}
                  {' '}
                  <i className="fas fa-sync fa-spin">{' '}</i>
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={this.toRemoveRemoteProducts}>
                  {Translator.trans('product.update.bar-code.confirm.remove_quantity')}
                </button>
              )}
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default View;
