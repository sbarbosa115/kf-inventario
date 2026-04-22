import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap4-modal';
import ReactTable from 'react-table';
import axios from 'axios';

class ConfirmSelectedProducts extends Component {
  constructor(props) {
    super(props);
    const { data, warehouseSource, warehouses } = this.props;

    const warehouseDestination = warehouses.find(item => (item.id !== warehouseSource));

    this.state = {
      data,
      dataRequest: {},
      warehouses,
      warehouseSource,
      warehouseDestination: warehouseDestination.id,
      loading: false,
      sending: false,
    };

    this.close = this.close.bind(this);
    this.moveProducts = this.moveProducts.bind(this);
    this.renderEditable = this.renderEditable.bind(this);
    this.selectDestinationWarehouse = this.selectDestinationWarehouse.bind(this);
  }

  moveProducts() {
    const { dataRequest, warehouseDestination, warehouseSource } = this.state;

    axios.post(Routing.generate('product_move', { warehouseSource, warehouseDestination }), {
      data: dataRequest,
    }).then(res => res.data).then(() => {
      this.close();
    });

    this.setState({
      sending: true,
    });
  }

  selectDestinationWarehouse(e) {
    this.setState({
      warehouseDestination: Number(e.target.value),
    });
  }

  close() {
    const { closeModal } = this.props;
    closeModal('confirmModal', false);
  }

  renderEditable(cellInfo) {
    const { data, dataRequest } = this.state;
    const options = [];
    const { uuid } = data[cellInfo.index];
    let defaultValue = null;

    for (let i = 1; i <= data[cellInfo.index][cellInfo.column.id]; i += 1) {
      if (dataRequest[uuid] === undefined && i === 1) {
        dataRequest[uuid] = {
          uuid,
          quantity: Number(i),
        };
      }
      if (dataRequest[uuid] !== undefined && dataRequest[uuid].quantity === i) {
        defaultValue = i;
        options.push(<option value={i} key={`${i}-KEY`}>{i}</option>);
      } else {
        options.push(<option value={i} key={`${i}-KEY`}>{i}</option>);
      }
    }

    return (
      cellInfo.original.quantity > 0
        ? (
          <select
            value={defaultValue}
            className="form-control form-control-sm"
            onChange={(e) => {
              dataRequest[data[cellInfo.index].uuid] = {
                uuid: data[cellInfo.index].uuid,
                quantity: Number(e.target.value),
              };
              this.setState({ dataRequest });
            }}
          >
            {options}
          </select>
        )
        : <span>{Translator.trans('product.template.no_available_product')}</span>
    );
  }

  render() {
    const {
      data, loading, warehouses, sending, warehouseSource,
    } = this.state;

    const columns = [{
      Header: Translator.trans('product.template.code'),
      accessor: 'code',
    }, {
      Header: Translator.trans('product.template.description'),
      accessor: 'title',
    }, {
      Header: Translator.trans('product.template.quantity'),
      accessor: 'quantity',
      Cell: this.renderEditable,
    }, {
      Header: Translator.trans('product.template.warehouse'),
      accessor: 'warehouse.name',
    }];
    return (
      <Modal visible dialogClassName="modal-lg">
        <div className="modal-header">
          <h5 className="modal-title">{Translator.trans('product.index.move_between_warehouses')}</h5>
        </div>
        <div className="modal-body">
          <div className="row">
            <div className="col-md-6">
              {Translator.trans('product.index.destination_warehouse')}
            </div>
            <div className="col-md-6">
              <select className="form-control" onChange={this.selectDestinationWarehouse}>
                {warehouses.map((item) => {
                  if (item.id !== warehouseSource) {
                    return (<option value={item.id} key={item.id}>{item.name}</option>);
                  }
                  return false;
                })}
              </select>
            </div>
          </div>
          <hr />
          <ReactTable data={data} columns={columns} defaultPageSize={5} loading={loading} />
        </div>
        <div className="modal-footer">
          { !sending
            ? (
              <button type="button" className="btn btn-secondary" onClick={this.moveProducts}>
                {Translator.trans('move')}
              </button>
            ) : (
              <button type="button" className="btn btn-secondary disabled">
                <i className="fas fa-sync fa-spin">&nbsp;</i>
                {Translator.trans('moving')}
              </button>
            )
          }
          <button type="button" className="btn btn-primary" onClick={this.close}>
            {Translator.trans('close')}
          </button>
        </div>
      </Modal>
    );
  }
}

export default ConfirmSelectedProducts;

ConfirmSelectedProducts.propTypes = {
  data: PropTypes.instanceOf(Array).isRequired,
  warehouseSource: PropTypes.number.isRequired,
  warehouses: PropTypes.instanceOf(Array).isRequired,
  closeModal: PropTypes.func.isRequired,
};
