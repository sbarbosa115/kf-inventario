import 'react-table/react-table.css';
import React, { Component } from 'react';
import ReactTable from 'react-table';
import axios from 'axios';

class View extends Component {
  constructor(props) {
    super(props);

    this.state = {
      data: [],
      loading: true,
      warehouseSource: 1,
      warehouses: [],
    };
    this.toApproveAllIncomingProducts = this.toApproveAllIncomingProducts.bind(this);
  }

  componentDidMount() {
    axios.get(Routing.generate('warehouse_all')).then(res => res.data).then(
      (result) => {
        if (result.length <= 0) {
          throw new Error('The number of warehouses is 0, please add another Warehouse');
        }
        const warehouse = result[0].id;
        this.setState({
          warehouses: result,
        });
        this.loadProducts(warehouse);
      },
    );
  }

  loadProducts(warehouse) {
    this.setState({
      loading: true,
    });
    axios.get(Routing.generate('product_all', { warehouse, status: 0 })).then(res => res.data).then(
      (result2) => {
        this.setState({
          loading: false,
          data: result2,
          warehouseSource: warehouse,
        });
      },
    );
  }

  toApproveAllIncomingProducts() {
    const { warehouseSource } = this.state;
    axios.post(Routing.generate('product_approve_incoming', { warehouse: warehouseSource })).then(res => res.data).then(
      () => {
        this.loadProducts(warehouseSource);
      },
    );
  }

  render() {
    const {
      loading, data, warehouses, warehouseSource,
    } = this.state;
    const columns = [{
      Header: Translator.trans('product.incoming.table.code'),
      accessor: 'code',
    }, {
      Header: Translator.trans('product.incoming.table.description'),
      accessor: 'title',
    }, {
      Header: Translator.trans('product.incoming.table.quantity'),
      accessor: 'quantity',
    }, {
      Header: Translator.trans('product.incoming.table.warehouse'),
      accessor: 'warehouse.name',
    }];

    return (
      <div>
        <div className="row">
          <div className="col-md-6">
            <select className="form-control" onChange={e => this.loadProducts(e.target.value)}>
              {warehouses.map(item => (
                <option
                  value={item.id}
                  key={item.id}
                  defaultValue={item.id === warehouseSource}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <hr />
        <div className="row">
          <div className="col-md-6">
            <button
              className="btn btn-sm btn-success mr-1"
              onClick={this.toApproveAllIncomingProducts}
              type="button"
            >
              <i className="fas fa-check">&nbsp;</i>
              {Translator.trans('product.incoming.approve_all')}
            </button>
          </div>
        </div>
        <hr />
        <ReactTable
          data={data}
          columns={columns}
          loading={loading}
          defaultPageSize={10}
          filterable
          className="-striped -highlight"
          keyField="uuid"
        />
      </div>
    );
  }
}

export default View;
