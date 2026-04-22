import React, { Component } from 'react';
import Modal from 'react-bootstrap4-modal';
import PropTypes from 'prop-types';
import axios from 'axios';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import moment from 'moment';

class DetailInvoice extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      invoice: null,
      products: [],
    };
  }

  componentWillMount() {
    const { invoiceDetailId } = this.props;
    this.setState({ loading: true });
    axios.get(Routing.generate('invoice_detail', { invoice: invoiceDetailId }))
      .then((response) => {
        this.setState({
          products: response.data.items || [],
          invoice: response.data,
          loading: false,
        });
      }).catch(() => this.setState({ loading: false }));
  }

  render() {
    const { invoice, products } = this.state;
    const { closeModal } = this.props;
    const columns = [{
      Header: 'Code',
      accessor: 'product.code',
      width: 100,
    }, {
      Header: 'Description',
      accessor: 'description',
    }, {
      Header: 'Quantity',
      accessor: 'quantity',
      width: 100,
    }, {
      Header: 'Unit Price',
      accessor: 'unitPrice',
      width: 140,
      Cell: row => (<div className="text-right">{row.original.unitPrice}</div>),
    }, {
      Header: 'Total',
      accessor: 'total',
      width: 140,
      Cell: row => (<div className="text-right">{row.original.total}</div>),
    }];

    return (
      <Modal dialogClassName="modal-lg" visible>
        <div className="modal-header">
          <h5 className="modal-title">{Translator.trans('invoice.index.detail')}</h5>
        </div>
        <div className="modal-body">
          { invoice && (
            <div>
              <div className="row mb-2">
                <div className="col-md-6">
                  <strong>{Translator.trans('invoice.index.code')}:</strong> {invoice.code}
                </div>
                <div className="col-md-6 text-right">
                  <a href={Routing.generate('invoice_pdf', { invoice: invoice.id })} className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer">{Translator.trans('invoice.index.view_pdf')}</a>
                </div>
              </div>
              <ReactTable
                data={products}
                columns={columns}
                defaultPageSize={10}
                className="-striped -highlight"
              />
              <div className="text-right mt-3">
                <strong>{Translator.trans('invoice.index.total')}: </strong> {invoice.total}
              </div>
            </div>
          ) }
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => closeModal()}>{Translator.trans('invoice.index.close')}</button>
        </div>
      </Modal>
    );
  }
}

DetailInvoice.propTypes = {
  invoiceDetailId: PropTypes.string.isRequired,
  closeModal: PropTypes.func.isRequired,
};

export default DetailInvoice;
