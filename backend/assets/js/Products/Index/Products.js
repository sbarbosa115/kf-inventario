import 'react-table/react-table.css';
import checkboxHOC from 'react-table/lib/hoc/selectTable';
import React, { useState, useEffect, useRef } from 'react';
import ReactTable from 'react-table';
import axios from 'axios';
import downloadjs from 'downloadjs';
import ConfirmSelectedProducts from './ConfirmSelectedProducts';

const CheckboxTable = checkboxHOC(ReactTable);

export default function Products() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [confirm, setConfirm] = useState([]);
  const [warehouseSource, setWarehouseSource] = useState(1);
  const [warehouses, setWarehouses] = useState([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const checkboxTableRef = useRef(null);

  const loadProducts = (warehouse) => {
    setLoading(true);
    axios.get(Routing.generate('product_all', { warehouse })).then(res => res.data).then((result) => {
      setData(result);
      setWarehouseSource(warehouse);
      setLoading(false);
    });
  };

  useEffect(() => {
    axios.get(Routing.generate('warehouse_all', null)).then(res => res.data).then((result) => {
      if (result.length <= 0) {
        throw new Error('The number of warehouses is 0, please add another Warehouse');
      }
      setWarehouses(result);
      loadProducts(result[0].id);
    });
  }, []);

  const toggleSelection = (key) => {
    setSelection(prev => {
      const index = prev.indexOf(key);
      return index >= 0
        ? [...prev.slice(0, index), ...prev.slice(index + 1)]
        : [...prev, key];
    });
  };

  const toggleAll = () => {
    const newSelectAll = !selectAll;
    let newSelection = [];
    if (newSelectAll) {
      const wrappedInstance = checkboxTableRef.current.getWrappedInstance();
      const currentRecords = wrappedInstance.getResolvedState().sortedData;
      newSelection = currentRecords.map(item => item._original.uuid);
    }
    setSelectAll(newSelectAll);
    setSelection(newSelection);
  };

  const isSelected = (key) => selection.includes(key);

  const openConfirmModal = (e) => {
    e.preventDefault();
    const selected = data.filter(item => selection.includes(item.uuid));
    setConfirm(selected);
    setConfirmModalOpen(true);
  };

  const closeConfirmModal = () => {
    setConfirmModalOpen(false);
    setSelection([]);
    loadProducts(warehouseSource);
  };

  const downloadExcel = () => {
    axios.get(Routing.generate('product_template', null), {
      params: { data: selection },
      responseType: 'blob',
    }).then((response) => {
      downloadjs(response.data, `${Translator.trans('product.template.products')}.xlsx`);
    });
  };

  const columns = [
    { Header: Translator.trans('product.template.code'), accessor: 'code' },
    { Header: Translator.trans('product.template.description'), accessor: 'detail' },
    { Header: Translator.trans('product.template.title'), accessor: 'title' },
    { Header: Translator.trans('product.template.quantity'), accessor: 'quantity' },
    { Header: Translator.trans('product.template.price'), accessor: 'price' },
    { Header: Translator.trans('product.template.warehouse'), accessor: 'warehouse.name' },
    {
      Header: Translator.trans('options'),
      Cell: ({ original }) => (
        <div>
          <a href={Routing.generate('product_update', { uuid: original.product.uuid })} className="btn btn-sm btn-success">
            <i className="fas fa-edit" />
          </a>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="row">
        <div className="col-md-6">
          <select className="form-control" onChange={e => loadProducts(e.target.value)}>
            {warehouses.map(item => (
              <option value={item.id} key={item.id} defaultValue={item.id === warehouseSource}>
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
            className={`btn btn-sm btn-success m-1${selection.length === 0 ? ' disabled' : ''}`}
            onClick={openConfirmModal}
            type="button"
          >
            <i className="fas fa-people-carry">&nbsp;</i>
            {Translator.trans('product.index.move_between_warehouses')}
          </button>
          <button
            className={`btn btn-sm btn-success m-1${selection.length === 0 ? ' disabled' : ''}`}
            onClick={downloadExcel}
            type="button"
          >
            <i className="fas fa-archive">&nbsp;</i>
            {Translator.trans('product.index.update_inventory_excel')}
          </button>
          <a href={Routing.generate('product_new', null)} className="btn btn-sm btn-success m-1">
            {Translator.trans('product.index.create_product')}
          </a>
        </div>
      </div>
      <hr />
      <CheckboxTable
        ref={checkboxTableRef}
        data={data}
        defaultFilterMethod={(filter, row) => {
          const id = filter.pivotId || filter.id;
          return row[id] !== undefined
            ? row[id].toString().toLowerCase().startsWith(filter.value.toLowerCase())
            : true;
        }}
        columns={columns}
        loading={loading}
        defaultPageSize={10}
        filterable
        className="-striped -highlight"
        selectAll={selectAll}
        isSelected={isSelected}
        toggleSelection={toggleSelection}
        toggleAll={toggleAll}
        selectType="checkbox"
        keyField="uuid"
      />
      {confirmModalOpen && confirm.length > 0 && (
        <ConfirmSelectedProducts
          data={confirm}
          closeModal={closeConfirmModal}
          warehouseSource={Number(warehouseSource)}
          warehouses={warehouses}
        />
      )}
    </div>
  );
}
