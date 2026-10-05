import 'react-table/react-table.css';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { first } from 'lodash';
import ReactTable from 'react-table';
import PropTypes from 'prop-types';
import moment from 'moment';
import ConfirmModal from '../../Widgets/ConfirmModal';
import DetailOrder from './DetailOrder';

const ORDER_STATE_SENT = 5;

const changeOrderState = (order, status, callback) => {
  axios.post(Routing.generate('order_change_status', { order, status }))
    .then(callback)
    .catch(callback);
};

const deleteOrder = (order, token, callback) => {
  axios.delete(Routing.generate('order_delete', null), { data: { order: order.id, token } })
    .then(callback);
};

const ORDER_STATES = [1, 2, 3, 4, 5, 6].map(id => ({
  id,
  name: Translator.trans(`order_statuses.${id}`),
}));

export default function Orders({ token, canAdd: canAddProp, canDelete: canDeleteProp, canSync: canSyncProp }) {
  const canAdd = canAddProp !== '';
  const canDelete = canDeleteProp !== '';
  const canSync = canSyncProp !== '';

  const [warehouses, setWarehouses] = useState([]);
  const [syncOrders, setSyncOrders] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [orderDetailId, setOrderDetailId] = useState(null);

  const loadOrders = (warehouse) => {
    setLoading(true);
    axios.get(Routing.generate('order_all', { warehouse })).then(res => res.data).then((result) => {
      setOrders(result);
      setLoading(false);
    });
  };

  useEffect(() => {
    axios.get(Routing.generate('warehouse_all', null)).then(res => res.data).then((result) => {
      if (result.length === 0) {
        throw new Error('The number of warehouses is 0, please add another Warehouse');
      }
      setWarehouses(result);
      loadOrders(first(result).id);
    });
  }, []);

  const syncExternalOrders = () => {
    setSyncOrders(true);
    axios.post(Routing.generate('order_sync_orders', null)).then(() => {
      setSyncOrders(false);
      window.location.reload();
    });
  };

  const columns = [{
    Header: '',
    filterable: false,
    width: 65,
    Cell: ({ original }) => (
      <button type="button" className="btn btn-sm btn-success">
        {`${original.comments.length} `}
        <i className="fas fa-comments" />
      </button>
    ),
  }, {
    accessor: 'customer',
    Header: Translator.trans('order.index.customer'),
    Cell: ({ original }) => `${original.customer.firstName} ${original.customer.lastName} [${original.customer.email}]`,
    filterMethod: (filter, row) => {
      const d = row._original;
      return (
        d.customer.firstName.toLowerCase().startsWith(filter.value.toLowerCase())
        || d.customer.lastName.toLowerCase().startsWith(filter.value.toLowerCase())
        || d.customer.email.toLowerCase().startsWith(filter.value.toLowerCase())
      );
    },
  }, {
    Header: Translator.trans('order.index.code'),
    accessor: 'code',
    filterMethod: (filter, row) => {
      const id = filter.pivotId || filter.id;
      return row[id] !== undefined
        ? row[id].toString().toLowerCase().startsWith(filter.value.toLowerCase())
        : true;
    },
    width: 200,
  }, {
    Header: Translator.trans('order.index.source'),
    accessor: 'source',
    filterable: false,
    width: 100,
    Cell: ({ original }) => {
      switch (original.source) {
        case 1: return Translator.trans('order.index.sources.web');
        case 2: return Translator.trans('order.index.sources.phone');
        default: return Translator.trans('order.index.sources.unknown');
      }
    },
  }, {
    Header: Translator.trans('order.index.status'),
    accessor: 'status',
    id: 'status',
    filterMethod: (filter, row) => {
      if (filter.value === '') return true;
      return Number(row[filter.id]) === Number(filter.value);
    },
    Filter: ({ filter, onChange }) => (
      <select onChange={event => onChange(event.target.value)} className="form-control input-xs" value={filter ? filter.value : ''}>
        <option value="">{Translator.trans('order.new.select_status')}</option>
        {ORDER_STATES.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
      </select>
    ),
    Cell: ({ original }) => (
      <select
        className="form-control form-control-sm"
        value={original.status}
        data-order-id={original.id}
        onChange={(e) => {
          const status = e.target.value;
          const order = e.target.attributes.getNamedItem('data-order-id').value;
          if (Number(status) === ORDER_STATE_SENT) {
            window.location.href = Routing.generate('order_getting_ready', { order: original.id });
          } else {
            changeOrderState(order, status, () => window.location.reload());
          }
        }}
      >
        {ORDER_STATES.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
      </select>
    ),
  }, {
    Header: Translator.trans('order.index.date'),
    filterable: false,
    width: 150,
    Cell: ({ original }) => (
      <div className="text-center">{moment(original.createdAt.date).format('DD MMM YYYY')}</div>
    ),
  }, {
    Header: Translator.trans('order.index.options'),
    filterable: false,
    Cell: ({ original }) => (
      <div>
        <button type="button" className="btn btn-sm btn-success" onClick={() => setOrderDetailId(original.id)}>
          {Translator.trans('order.index.detail')}
        </button>
        {' '}
        <a href={Routing.generate('order_edit', { order: original.id })} className="btn btn-sm btn-success" title={Translator.trans('order.index.edit_order')}>
          <i className="fas fa-pencil-alt" />
        </a>
        {' '}
        <a href={Routing.generate('order_getting_ready', { order: original.id })} className="btn btn-sm btn-success" title={Translator.trans('order.index.getting_ready')}>
          <i className="fas fa-truck-loading" />
        </a>
        {' '}
        <a href={Routing.generate('order_pdf', { order: original.id })} className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer" title={Translator.trans('order.index.view_pdf')}>
          <i className="fas fa-file-pdf" />
        </a>
        {' '}
        <a href={Routing.generate('order_xls', { order: original.id })} className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer" title={Translator.trans('order.index.download_excel')}>
          <i className="fas fa-file-excel" />
        </a>
        {' '}
        {canDelete && (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setOrderToDelete(original)}>
            <i className="fas fa-trash" />
          </button>
        )}
      </div>
    ),
  }];

  return (
    <div>
      {orderToDelete && (
        <ConfirmModal
          onOk={() => deleteOrder(orderToDelete, token, () => window.location.reload())}
          onCancel={() => setOrderToDelete(false)}
        >
          <h4>{Translator.trans('order.index.confirm_delete_order')}</h4>
        </ConfirmModal>
      )}
      <div className="row">
        <div className="col-md-6">
          <select className="form-control" onChange={e => loadOrders(e.target.value)}>
            {warehouses.map(item => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          {canAdd && (
            <a className="btn btn-success" href={Routing.generate('order_new', null)}>
              {Translator.trans('order.index.new')}
            </a>
          )}
          {canSync && (
            <button type="button" className="btn btn-secondary ml-1" onClick={syncExternalOrders} disabled={syncOrders}>
              <i className={`fas fa-sync${syncOrders ? ' fa-spin' : ''}`} />
            </button>
          )}
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
        keyField="id"
      />
      {orderDetailId !== null && (
        <DetailOrder orderDetailId={orderDetailId} closeModal={() => setOrderDetailId(null)} />
      )}
    </div>
  );
}

Orders.propTypes = {
  token: PropTypes.string.isRequired,
  canAdd: PropTypes.string.isRequired,
  canDelete: PropTypes.string.isRequired,
  canSync: PropTypes.string.isRequired,
};
