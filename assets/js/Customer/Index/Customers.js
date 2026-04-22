import 'react-table/react-table.css';
import React, { Component } from 'react';
import ReactTable from 'react-table';
import axios from 'axios';
import PropTypes from 'prop-types';
import ConfirmModal from '../../Widgets/ConfirmModal';

const deleteCustomerHandler = (customerId, token) => (
  new Promise(resolve => (
    axios.delete(Routing.generate('customer_delete', null), { data: { customer: customerId, token } })
      .then(() => resolve())
  ))
);

class Customers extends Component {
  constructor(props) {
    super(props);

    this.state = {
      toggleOpenModalConfirmDeleteCustomer: false,
      customerToDelete: null,
    };

    this.toggleModalConfirmDeleteCustomer = this.toggleModalConfirmDeleteCustomer.bind(this);
  }

  toggleModalConfirmDeleteCustomer() {
    const { toggleOpenModalConfirmDeleteCustomer } = this.state;
    this.setState({
      toggleOpenModalConfirmDeleteCustomer: !toggleOpenModalConfirmDeleteCustomer,
    });
  }

  render() {
    const { customers, token } = this.props;
    const { toggleOpenModalConfirmDeleteCustomer, customerToDelete } = this.state;
    const columns = [
      {
        Header: Translator.trans('customer.index.name'),
        Cell: row => `${row.original.firstName} ${row.original.lastName}`,
        filterMethod: (filter, row) => {
          const rowData = row._original;
          return (
            String(rowData.firstName.toLowerCase()).startsWith(filter.value.toLowerCase())
            || String(rowData.lastName.toLowerCase()).startsWith(filter.value.toLowerCase())
          );
        },
      },
      {
        Header: Translator.trans('customer.index.email'),
        accessor: 'email',
      },
      {
        Header: Translator.trans('customer.index.phone'),
        accessor: 'phone',
      },
      {
        Cell: row => (
          <div>
            <a
              href={Routing.generate('customer_edit', { customer: row.original.id })}
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
              onClick={() => {
                this.setState({
                  customerToDelete: row.original.id,
                });
                this.toggleModalConfirmDeleteCustomer();
              }}
            >
              <i className="fas fa-times-circle" />
            </button>
          </div>
        ),
        Header: Translator.trans('customer.index.options'),
        filterable: false,
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
          filterable
          data={customers}
          columns={columns}
          className="-striped -highlight"
        />

        {toggleOpenModalConfirmDeleteCustomer
        && (
        <ConfirmModal
          visible
          onCancel={() => this.toggleModalConfirmDeleteCustomer()}
          onOk={() => deleteCustomerHandler(
            customerToDelete,
            token,
          ).then(() => {
            this.toggleModalConfirmDeleteCustomer();
            window.location.reload();
          })}
        >
          <h4>{Translator.trans('customer.index.confirm_delete_customer')}</h4>
        </ConfirmModal>
        )}
      </div>
    );
  }
}

export default Customers;

Customers.propTypes = {
  customers: PropTypes.instanceOf(Array).isRequired,
  token: PropTypes.string.isRequired,
};
