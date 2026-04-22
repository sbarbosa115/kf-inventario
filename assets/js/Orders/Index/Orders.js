import 'react-table/react-table.css';
import React, { Component } from 'react';
import axios from 'axios';
import { first } from 'lodash';
import ReactTable from 'react-table';
import PropTypes from 'prop-types';
import moment from 'moment';
import ConfirmModal from '../../Widgets/ConfirmModal';
import DetailOrder from './DetailOrder';

const ORDER_STATE_SENT = 5;

const changeOrderState = (order, status, callback) => {
  axios.post(Routing.generate('order_change_status', { order, status })).then(() => {
    if (typeof callback === 'function') {
      callback();
    }
  }).catch(() => {
    if (typeof callback === 'function') {
      callback();
    }
  });
};

const deleteOrder = (order, token, callback) => {
  axios.delete(Routing.generate('order_delete', null), { data: { order: order.id, token } })
    .then(() => {
      if (typeof callback === 'function') {
        callback();
      }
    });
};

class Orders extends Component {
  constructor(props) {
    super(props);

    const canAdd = (props.canAdd !== '');
    const canDelete = (props.canDelete !== '');
    const canSync = (props.canSync !== '');

    this.state = {
      canAdd,
      canDelete,
      canSync,
      warehouses: [],
      syncOrders: false,
      orderToDelete: false,
      loading: true,
      orders: [],
      orderDetailId: null,
      orderStates: [
        { name: Translator.trans('order_statuses.1'), id: 1 },
        { name: Translator.trans('order_statuses.2'), id: 2 },
        { name: Translator.trans('order_statuses.3'), id: 3 },
        { name: Translator.trans('order_statuses.4'), id: 4 },
        { name: Translator.trans('order_statuses.5'), id: 5 },
        { name: Translator.trans('order_statuses.6'), id: 6 },
      ],
    };

    this.detail = this.detail.bind(this);
    this.closeDetailModal = this.closeDetailModal.bind(this);
    this.syncExternalOrders = this.syncExternalOrders.bind(this);
  }

  componentDidMount() {
    axios.get(Routing.generate('warehouse_all', null)).then(res => res.data).then(
      (result) => {
        if (result.length === 0) {
          throw new Error('The number of warehouses is 0, please add another Warehouse');
        }

        const warehouse = first(result);
        this.setState({
          warehouses: result,
        });
        this.loadOrders(warehouse.id);
      },
    );
  }

  loadOrders(warehouse) {
    this.setState({
      loading: true,
    });
    axios.get(Routing.generate('order_all', { warehouse })).then(res => res.data).then(
      (result) => {
        this.setState({
          orders: result,
          loading: false,
        });
      },
    );
  }

  detail(orderId) {
    this.setState({
      orderDetailId: orderId,
    });
  }

  closeDetailModal() {
    this.setState({
      orderDetailId: null,
    });
  }

  syncExternalOrders() {
    this.setState({ syncOrders: true });
    axios.post(Routing.generate('order_sync_orders', null)).then(() => {
      this.setState({ syncOrders: false });
      window.location.reload();
    });
  }

  render() {
    const {
      selectAll, orders, warehouses, loading, orderDetailId, orderStates, orderToDelete,
      syncOrders, canAdd, canDelete, canSync, confirmSent,
    } = this.state;
    const { token } = this.props;
    const { toggleSelection, toggleAll, isSelected } = this;
    const columns = [{
      Header: '',
      filterable: false,
      width: 65,
      Cell: row => (
        <button type="button" className="btn btn-sm btn-success">
          {`${row.original.comments.length} `}
          <i className="fas fa-comments" />
        </button>
      ),
    }, {
      accessor: 'customer',
      Header: Translator.trans('order.index.customer'),
      Cell: row => `${row.original.customer.firstName} ${row.original.customer.lastName} [${row.original.customer.email}]`,
      filterMethod: (filter, row) => {
        const rowData = row._original;
        return (
          String(rowData.customer.firstName.toLowerCase()).startsWith(filter.value.toLowerCase())
          || String(rowData.customer.lastName.toLowerCase()).startsWith(filter.value.toLowerCase())
          || String(rowData.customer.email.toLowerCase()).startsWith(filter.value.toLowerCase())
        );
      },
    }, {
      Header: Translator.trans('order.index.code'),
      accessor: 'code',
      filterMethod: (filter, row) => {
        const id = filter.pivotId || filter.id;
        if (row[id] !== undefined) {
          return row[id].toString().toLowerCase().startsWith(filter.value.toLowerCase());
        }
        return true;
      },
      width: 200,
    }, {
      Cell: (row) => {
        switch (row.original.source) {
          case 1:
            return Translator.trans('order.index.sources.web');
          case 2:
            return Translator.trans('order.index.sources.phone');
          default:
            return Translator.trans('order.index.sources.unknown');
        }
      },
      Header: Translator.trans('order.index.source'),
      accessor: 'source',
      filterable: false,
      width: 100,
    }, {
      Cell: row => (
        <select
          className="form-control form-control-sm"
          onChange={(e) => {
            const status = e.target.value;
            const order = e.target.attributes.getNamedItem('data-order-id').value;

            if (Number(status) === ORDER_STATE_SENT) {
              window.location.href = Routing.generate('order_getting_ready', { order: row.original.id });
            } else {
              changeOrderState(order, status, () => window.location.reload());
            }
          }}
          value={row.original.status}
          data-order-id={row.original.id}
        >
          { orderStates.map(status => (
            <option value={status.id} key={status.id}>{status.name}</option>
          ))}
        </select>
      ),
      Header: Translator.trans('order.index.status'),
      accessor: 'status',
      id: 'status',
      filterMethod: (filter, row) => {
        if (filter.value === '') {
          return true;
        }
        return Number(row[filter.id]) === Number(filter.value);
      },
      Filter: ({ filter, onChange }) => (
        <select
          onChange={event => onChange(event.target.value)}
          className="form-control input-xs"
          value={filter ? filter.value : ''}
        >
          <option value="">{Translator.trans('order.new.select_status')}</option>
          {orderStates.map(orderStatusItem => (
            <option value={orderStatusItem.id} key={orderStatusItem.id}>
              {orderStatusItem.name}
            </option>
          ))}
        </select>
      ),
    }, {
      Cell: row => (
        <div className="text-center">
          {moment(row.original.createdAt.date).format('DD MMM YYYY')}
        </div>
      ),
      Header: Translator.trans('order.index.date'),
      filterable: false,
      width: 150,
    }, {
      Cell: row => (
        <div>
          <button type="button" className="btn btn-sm btn-success" onClick={() => this.detail(row.original.id)}>
            {Translator.trans('order.index.detail')}
          </button>
          { ' ' }
          <a href={Routing.generate('order_edit', { order: row.original.id })} className="btn btn-sm btn-success" rel="noopener noreferrer" title={Translator.trans('order.index.edit_order')}>
            <i className="fas fa-pencil-alt" />
          </a>
          { ' ' }
          <a href={Routing.generate('order_getting_ready', { order: row.original.id })} className="btn btn-sm btn-success" rel="noopener noreferrer" title={Translator.trans('order.index.getting_ready')}>
            <i className="fas fa-truck-loading" />
          </a>
          { ' ' }
          <a href={Routing.generate('order_pdf', { order: row.original.id })} className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer" title={Translator.trans('order.index.view_pdf')}>
            <i className="fas fa-file-pdf" />
          </a>
          { ' ' }
          <a href={Routing.generate('order_xls', { order: row.original.id })} className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer" title={Translator.trans('order.index.download_excel')}>
            <i className="fas fa-file-excel" />
          </a>
          { ' ' }
          { canDelete
            && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => this.setState({ orderToDelete: row.original })}>
                <i className="fas fa-trash" />
              </button>
            )
          }
        </div>
      ),
      Header: Translator.trans('order.index.options'),
      filterable: false,
    }];
    const checkboxProps = {
      selectAll,
      isSelected,
      toggleSelection,
      toggleAll,
      selectType: 'checkbox',
    };
    return (
      <div>
        { orderToDelete
          && (
          <ConfirmModal
            visible={orderToDelete !== false}
            onOk={() => deleteOrder(orderToDelete, token, () => (
              window.location.reload()
            ))}
            onCancel={() => this.setState({ orderToDelete: false })}
          >
            <h4>{Translator.trans('order.index.confirm_delete_order')}</h4>
          </ConfirmModal>
          )
        }
        { confirmSent
        && (
          <ConfirmModal
            visible={confirmSent !== false}
            onOk={confirmSent}
            onCancel={() => this.setState({ confirmSent: false })}
          >
            <h4>{Translator.trans('order.index.confirm_change_state_to_sent')}</h4>
          </ConfirmModal>
        )
        }
        <div className="row">
          <div className="col-md-6">
            <select className="form-control" onChange={e => this.loadOrders(e.target.value)}>
              {warehouses.map(item => (
                <option
                  value={item.id}
                  key={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            {
              canAdd && (
                <a
                  className="btn btn-success"
                  href={Routing.generate('order_new', null)}
                >
                  {Translator.trans('order.index.new')}
                </a>
              )
            }
          </div>
        </div>
        <hr />
        <ReactTable
          data={orders}
          columns={columns}
          loading={loading}
          defaultPageSize={10}
          filterable
          className="-striped -highlight"
          {...checkboxProps}
          keyField="id"
        />
        { orderDetailId !== null
          && <DetailOrder orderDetailId={orderDetailId} closeModal={this.closeDetailModal} />
        }
      </div>
    );
  }
}

export default Orders;

Orders.propTypes = {
  token: PropTypes.string.isRequired,
  canAdd: PropTypes.string.isRequired,
  canDelete: PropTypes.string.isRequired,
  canSync: PropTypes.string.isRequired,
};

