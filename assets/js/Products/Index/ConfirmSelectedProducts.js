import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap4-modal';
import ReactTable from 'react-table';
import axios from 'axios';

export default function ConfirmSelectedProducts({
  data, warehouseSource, warehouses, closeModal,
}) {
  const initialDestination = warehouses.find(item => item.id !== warehouseSource);

  const [dataRequest, setDataRequest] = useState({});
  const [warehouseDestination, setWarehouseDestination] = useState(initialDestination.id);
  const [sending, setSending] = useState(false);

  const moveProducts = () => {
    setSending(true);
    axios.post(
      Routing.generate('product_move', { warehouseSource, warehouseDestination }),
      { data: dataRequest },
    ).then(() => closeModal('confirmModal', false));
  };

  const renderEditable = (cellInfo) => {
    const options = [];
    const { uuid } = data[cellInfo.index];
    let defaultValue = null;
    const current = { ...dataRequest };

    for (let i = 1; i <= data[cellInfo.index][cellInfo.column.id]; i += 1) {
      if (current[uuid] === undefined && i === 1) {
        current[uuid] = { uuid, quantity: 1 };
      }
      if (current[uuid] !== undefined && current[uuid].quantity === i) {
        defaultValue = i;
      }
      options.push(<option value={i} key={`${i}-KEY`}>{i}</option>);
    }

    return cellInfo.original.quantity > 0 ? (
      <select
        value={defaultValue}
        className="form-control form-control-sm"
        onChange={(e) => {
          setDataRequest(prev => ({
            ...prev,
            [data[cellInfo.index].uuid]: { uuid: data[cellInfo.index].uuid, quantity: Number(e.target.value) },
          }));
        }}
      >
        {options}
      </select>
    ) : <span>{Translator.trans('product.template.no_available_product')}</span>;
  };

  const columns = [
    { Header: Translator.trans('product.template.code'), accessor: 'code' },
    { Header: Translator.trans('product.template.description'), accessor: 'title' },
    { Header: Translator.trans('product.template.quantity'), accessor: 'quantity', Cell: renderEditable },
    { Header: Translator.trans('product.template.warehouse'), accessor: 'warehouse.name' },
  ];

  return (
    <Modal visible dialogClassName="modal-lg">
      <div className="modal-header">
        <h5 className="modal-title">{Translator.trans('product.index.move_between_warehouses')}</h5>
      </div>
      <div className="modal-body">
        <div className="row">
          <div className="col-md-6">{Translator.trans('product.index.destination_warehouse')}</div>
          <div className="col-md-6">
            <select className="form-control" onChange={e => setWarehouseDestination(Number(e.target.value))}>
              {warehouses.map(item => item.id !== warehouseSource && (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
        <hr />
        <ReactTable data={data} columns={columns} defaultPageSize={5} />
      </div>
      <div className="modal-footer">
        {sending ? (
          <button type="button" className="btn btn-secondary disabled">
            <i className="fas fa-sync fa-spin">&nbsp;</i>
            {Translator.trans('moving')}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={moveProducts}>
            {Translator.trans('move')}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => closeModal('confirmModal', false)}>
          {Translator.trans('close')}
        </button>
      </div>
    </Modal>
  );
}

ConfirmSelectedProducts.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  warehouseSource: PropTypes.number.isRequired,
  warehouses: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  closeModal: PropTypes.func.isRequired,
};
