import 'react-table/react-table.css';
import React, { useState } from 'react';
import ReactTable from 'react-table';
import axios from 'axios';
import PropTypes from 'prop-types';
import ConfirmModal from '../../Widgets/ConfirmModal';

const deleteCustomer = (customerId, token) =>
  axios.delete(Routing.generate('customer_delete', null), { data: { customer: customerId, token } });

export default function Customers({ customers, token, pagination }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  const columns = [
    {
      Header: Translator.trans('customer.index.name'),
      Cell: ({ original }) => `${original.firstName} ${original.lastName}`,
      filterMethod: (filter, row) => {
        const d = row._original;
        return (
          d.firstName.toLowerCase().startsWith(filter.value.toLowerCase())
          || d.lastName.toLowerCase().startsWith(filter.value.toLowerCase())
        );
      },
    },
    { Header: Translator.trans('customer.index.email'), accessor: 'email' },
    { Header: Translator.trans('customer.index.phone'), accessor: 'phone' },
    {
      Header: Translator.trans('customer.index.options'),
      filterable: false,
      Cell: ({ original }) => (
        <div>
          <a
            href={Routing.generate('customer_edit', { customer: original.id })}
            className="btn btn-sm btn-success"
            title={Translator.trans('customer.index.edit_this')}
          >
            <i className="fas fa-pencil-alt" />
          </a>
          {' '}
          <button
            className="btn btn-sm btn-danger"
            title={Translator.trans('customer.index.delete')}
            type="button"
            onClick={() => { setCustomerToDelete(original.id); setShowDeleteModal(true); }}
          >
            <i className="fas fa-times-circle" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="row">
        <div className="col-md-6">
          <a className="btn btn-success" href={Routing.generate('customer_new', null)}>
            {Translator.trans('customer.index.create_customer')}
          </a>
        </div>
      </div>
      <hr />
      <ReactTable
        manual
        filterable
        data={customers}
        columns={columns}
        className="-striped -highlight"
        pages={pagination.totalPages}
        page={pagination.currentPage - 1}
        defaultPageSize={pagination.limit}
        onPageChange={(pageIndex) => {
          window.location.href = `${Routing.generate('customer_index', null)}?page=${pageIndex + 1}`;
        }}
      />
      {showDeleteModal && (
        <ConfirmModal
          onCancel={() => setShowDeleteModal(false)}
          onOk={() => deleteCustomer(customerToDelete, token).then(() => {
            setShowDeleteModal(false);
            window.location.reload();
          })}
        >
          <h4>{Translator.trans('customer.index.confirm_delete_customer')}</h4>
        </ConfirmModal>
      )}
    </div>
  );
}

Customers.propTypes = {
  customers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  token: PropTypes.string.isRequired,
  pagination: PropTypes.shape({
    total: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
    currentPage: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
  }).isRequired,
};
