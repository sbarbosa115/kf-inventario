import React, { Component } from 'react';
import Modal from 'react-bootstrap4-modal';
import axios from 'axios';
import PropTypes from 'prop-types';
import _ from 'lodash';

class PartialHandler extends Component {
  constructor(props) {
    super(props);

    const { order, partials } = props;

    this.state = {
      currentText: '',
      partials: [],
      originalPartials: _.cloneDeep(partials),
      sending: false,
      order,
      modalProductNotInOrder: false,
      modalProductLimitReached: false,
      modalProductLimitInventoryReached: false,
    };
  }

  componentDidMount() {
    this.addProductText.focus();
  }

  getPartialQuantity(uuid) {
    const { originalPartials } = this.state;
    return originalPartials.filter(partialProduct => (
      partialProduct.uuid.toLowerCase() === uuid.toLowerCase()
    )).reduce((acc, partialProduct) => (partialProduct.quantity), 0);
  }

  getCurrentOrderProductQuantity(uuid) {
    const { partials } = this.state;
    return partials.filter(partialProduct => (
      partialProduct.uuid.toLowerCase() === uuid.toLowerCase()
    )).reduce((acc, partialProduct) => (partialProduct.quantity), 0);
  }

  getReadyProductToOrder(productCode) {
    const { order, partials } = this.state;
    const orderCloned = _.cloneDeep(order);

    const doesExistPartialIndex = partials
      .findIndex(partialProduct => (
        partialProduct.product.code.toLowerCase() === productCode.toLowerCase()
      ));

    if (doesExistPartialIndex === -1) {
      partials.push(orderCloned.products
        .filter(partialProduct => (
          partialProduct.product.code.toLowerCase() === productCode.toLowerCase()
        ))
        .map((partialProduct) => {
          partialProduct.quantity = this.getCurrentOrderProductQuantity(partialProduct.uuid) + 1;
          return partialProduct;
        }).find(partialProduct => partialProduct));
    } else {
      partials[doesExistPartialIndex].quantity = this.getCurrentOrderProductQuantity(
        partials[doesExistPartialIndex].uuid,
      ) + 1;
    }

    this.setState({
      partials,
      currentText: '',
    });
  }

  getProductQuantityToDisplay(product) {
    const diff = product.quantity - (
      this.getPartialQuantity(product.uuid) + this.getCurrentOrderProductQuantity(product.uuid)
    );

    if (diff <= 0) {
      return '~';
    }

    return diff;
  }

  getBackgroundCell(product) {
    if (this.getProductQuantityToDisplay(product) === '~') {
      return 'row-selected-completed';
    }

    if (product.quantity === (
      product.quantity - (
        this.getPartialQuantity(product.uuid) + this.getCurrentOrderProductQuantity(product.uuid)
      )
    )) {
      return 'row-selected-all-pending';
    }

    return 'row-selected-some-added';
  }

  getProductQuantityOnInventory(productCode) {
    const { inventory } = this.props;
    return inventory.filter(productInventory => (
      productInventory.product.code.toLowerCase() === productCode.toLowerCase()
    )).reduce((acc, productInventory) => (
      productInventory.quantity
    ), 0);
  }

  isThisProductOnOrder(productCode) {
    const { order } = this.state;
    return order.products
      .some(product => product.product.code.toLowerCase() === productCode.toLowerCase());
  }

  currentText(e) {
    this.setState({
      currentText: e.target.value,
    });
  }

  isAllowedToAddMoreProducts(productCode) {
    const { order } = this.state;

    return order.products
      .filter(product => (product.product.code.toLowerCase() === productCode.toLowerCase()))
      .reduce((acc, productInOrder) => (
        (
          productInOrder.quantity
          - (this.getPartialQuantity(productInOrder.uuid)
              + this.getCurrentOrderProductQuantity(productInOrder.uuid))
        ) > 0
      ), false);
  }

  isAvailableQuantityOnInventory(productCode) {
    return this.getProductQuantityOnInventory(productCode) > 0;
  }

  addProductHandler(productCode) {
    if (!this.isThisProductOnOrder(productCode)) {
      this.setState({
        modalProductNotInOrder: true,
      });
    } else if (!this.isAvailableQuantityOnInventory(productCode)) {
      this.setState({
        modalProductLimitInventoryReached: true,
      });
    } else if (!this.isAllowedToAddMoreProducts(productCode)) {
      this.setState({
        modalProductLimitReached: true,
      });
    } else {
      this.getReadyProductToOrder(productCode);
    }
  }

  addProductOnChangeHandler(e) {
    const { currentText } = this.state;
    if (currentText) {
      this.addProductHandler(currentText);
      e.preventDefault();
    }
  }

  addProductKeyPressHandler(e) {
    const { currentText } = this.state;
    if (e.key === 'Enter' && currentText) {
      this.addProductHandler(currentText);
      e.preventDefault();
    }
  }

  removeProductHandler(productCode) {
    const { partials } = this.state;

    const doesExistPartialIndex = partials
      .findIndex(partialProduct => (partialProduct.product.code === productCode));

    if (doesExistPartialIndex > -1) {
      const newQuantity = this.getCurrentOrderProductQuantity(
        partials[doesExistPartialIndex].uuid,
      );

      partials[doesExistPartialIndex].quantity = (newQuantity - 1);

      const removedZeroPartials = partials.filter(partial => partial.quantity !== 0);
      this.setState({ partials: removedZeroPartials });
    }
  }

  sendRequest() {
    const { order, partials } = this.state;

    this.setState({ sending: true }, () => (
      axios.post(Routing.generate('order_partial', { order: order.id }), partials)
        .then(() => { window.location.href = Routing.generate('order_index', null); })
    ));
  }

  render() {
    const {
      sending, order, currentText, modalProductNotInOrder, modalProductLimitReached,
      modalProductLimitInventoryReached,
    } = this.state;

    return (
      <div>
        <div className="row">
          <div className="col-md-12">
            <form>
              <p>
                {Translator.trans('order.getting_ready.description')}
              </p>
              <div className="form-inline">
                <input
                  type="text"
                  className="form-control form-control-sm my-1 mr-sm-2"
                  placeholder={Translator.trans('order.getting_ready.bar_code')}
                  value={currentText}
                  onChange={e => this.currentText(e)}
                  onKeyPress={e => this.addProductKeyPressHandler(e)}
                  ref={(input) => { this.addProductText = input; }}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm my-2"
                  onClick={e => this.addProductOnChangeHandler(e)}
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
                    <tr
                      key={`${product.product.uuid}-${product.product.code}`}
                      className={this.getBackgroundCell(product)}
                    >
                      <th scope="row">{productKey + 1}</th>
                      <td width="15%">
                        {product.product.code}
                      </td>
                      <td width="35%">
                        {product.product.detail}
                      </td>
                      <td width="5%" className="text-center">
                        <button
                          className="btn btn-info btn-sm"
                          type="button"
                          title={Translator.trans('order.getting_ready.inventory_available')}
                        >
                          {this.getProductQuantityOnInventory(product.product.code)}
                        </button>
                      </td>
                      <td width="15%" className="text-center">
                        {product.quantity}
                        { ' / ' }
                        {this.getProductQuantityToDisplay(product)}
                      </td>
                      <td className="text-center">
                        {this.getPartialQuantity(product.uuid)}
                      </td>
                      <td className="text-center">
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          readOnly
                          value={this.getCurrentOrderProductQuantity(product.uuid)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => this.removeProductHandler(product.product.code)}
                          data-toggle="tooltip"
                          data-placement="top"
                          title={Translator.trans('order.getting_ready.remove_products')}
                          disabled={this.getCurrentOrderProductQuantity(product.uuid) === 0}
                        >
                          <i className="fas fa-minus-circle" />
                        </button>
                        { ' ' }
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => this.addProductHandler(product.product.code)}
                          data-toggle="tooltip"
                          data-placement="top"
                          title={Translator.trans('order.getting_ready.add_products')}
                          disabled={this.getProductQuantityToDisplay(product) === '~'}
                        >
                          <i className="fas fa-plus-circle" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  { order.products.length === 0
                && (
                  <tr>
                    <td colSpan="5" className="text-center">
                      {Translator.trans('order.getting_ready.no_products')}
                    </td>
                  </tr>
                )
                }
                </tbody>
              </table>

              <div className="form-row">
                <div className="form-group col-md-6">
                  <a className="btn btn-danger btn-block" href={Routing.generate('order_index', { order: order.id })}>
                    {Translator.trans('cancel')}
                  </a>
                </div>
                <div className="form-group col-md-6">
                  <button
                    className="btn btn-success btn-block"
                    type="button"
                    disabled={
                      sending || order.status === 5 || order.status === 6
                    }
                    onClick={() => (this.sendRequest())}
                  >
                    {Translator.trans('order.getting_ready.add_partial')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        {modalProductNotInOrder && (
          <Modal visible>
            <div className="modal-header">
              <h5 className="modal-title">{Translator.trans('order.getting_ready.modal_product_not_in_order.error')}</h5>
            </div>
            <div className="modal-body">
              <div className="row p-3">
                <h5 className="modal-title">{Translator.trans('order.getting_ready.modal_product_not_in_order.title')}</h5>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  this.addProductText.focus();
                  this.setState({
                    modalProductNotInOrder: false,
                    currentText: '',
                  });
                }}
              >
                {Translator.trans('order.getting_ready.modal_product_not_in_order.action_ok')}
              </button>
            </div>
          </Modal>
        )}
        {modalProductLimitReached && (
          <Modal visible>
            <div className="modal-header">
              <h5 className="modal-title">{Translator.trans('order.getting_ready.modal_product_limit_reached.error')}</h5>
            </div>
            <div className="modal-body">
              <div className="row p-3">
                <h5 className="modal-title">{Translator.trans('order.getting_ready.modal_product_limit_reached.title')}</h5>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  this.addProductText.focus();
                  this.setState({
                    modalProductLimitReached: false,
                    currentText: '',
                  });
                }}
              >
                {Translator.trans('order.getting_ready.modal_product_limit_reached.action_ok')}
              </button>
            </div>
          </Modal>
        )}
        {modalProductLimitInventoryReached && (
          <Modal visible>
            <div className="modal-header">
              <h5 className="modal-title">{Translator.trans('order.getting_ready.modal_product_inventory_limit_reached.error')}</h5>
            </div>
            <div className="modal-body">
              <div className="row p-3">
                <h5 className="modal-title">{Translator.trans('order.getting_ready.modal_product_inventory_limit_reached.title')}</h5>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  this.addProductText.focus();
                  this.setState({
                    modalProductLimitInventoryReached: false,
                    currentText: '',
                  });
                }}
              >
                {Translator.trans('order.getting_ready.modal_product_inventory_limit_reached.action_ok')}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default PartialHandler;

PartialHandler.propTypes = {
  partials: PropTypes.instanceOf(Array).isRequired,
  order: PropTypes.shape({}).isRequired,
  inventory: PropTypes.instanceOf(Array).isRequired,
};
