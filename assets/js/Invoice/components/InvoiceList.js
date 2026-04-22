import React, { useState, useEffect } from 'react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import PropTypes from 'prop-types';
import axios from 'axios';
import moment from 'moment';
import DetailInvoice from './DetailInvoice';

export default function InvoiceList(props) {
    const { token } = props;
    const canAdd = (props.canAdd !== '');
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [invoiceDetailId, setInvoiceDetailId] = useState(null);

    useEffect(() => {
        setLoading(true);
        axios.get(Routing.generate('invoice_all', null)).then(res => res.data).then((result) => {
            setInvoices(result);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const columns = [{
        Header: Translator.trans('invoice.index.code'),
        accessor: 'code',
        width: 200,
    }, {
        Header: Translator.trans('invoice.index.customer'),
        accessor: 'customer',
        Cell: row => (row.original.customer ? `${row.original.customer.firstName || ''} ${row.original.customer.lastName || ''} [${row.original.customer.email || ''}]` : 'POS Client'),
        filterMethod: (filter, row) => {
            const rowData = row._original;
            if (!rowData.customer) return false;
            return (
                String(rowData.customer.firstName || '').toLowerCase().startsWith(filter.value.toLowerCase())
                || String(rowData.customer.lastName || '').toLowerCase().startsWith(filter.value.toLowerCase())
                || String(rowData.customer.email || '').toLowerCase().startsWith(filter.value.toLowerCase())
            );
        },
    }, {
        Header: Translator.trans('invoice.index.total'),
        accessor: 'total',
        Cell: row => (<div className="text-right">{row.original.total}</div>),
        width: 120,
    }, {
        Header: Translator.trans('invoice.index.date'),
        accessor: 'createdAt',
        Cell: row => (
            <div className="text-center">{ row.original.createdAt ? moment(row.original.createdAt.date).format('DD MMM YYYY') : '' }</div>
        ),
        filterable: false,
        width: 150,
    }, {
        Header: Translator.trans('invoice.index.options'),
        filterable: false,
        Cell: row => (
            <div>
                <button type="button" className="btn btn-sm btn-success" onClick={() => setInvoiceDetailId(row.original.id)}>
                    {Translator.trans('invoice.index.detail')}
                </button>
                { ' ' }
                <a href={Routing.generate('invoice_pdf', { invoice: row.original.id })} className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer">
                    <i className="fas fa-file-pdf" />
                </a>
            </div>
        ),
    }];

    return (
        <div>
            <div className="row mb-2">
                <div className="col-md-6">
                    { canAdd && (
                        <a className="btn btn-success" href={Routing.generate('invoice_new', null)}>
                            {Translator.trans('invoice.new.title')}
                        </a>
                    ) }
                </div>
            </div>
            <ReactTable
                data={invoices}
                columns={columns}
                loading={loading}
                defaultPageSize={10}
                filterable
                className="-striped -highlight"
                keyField="id"
            />
            { invoiceDetailId !== null && (
                <DetailInvoice invoiceDetailId={invoiceDetailId} closeModal={() => setInvoiceDetailId(null)} />
            ) }
        </div>
    );
}

InvoiceList.propTypes = {
    token: PropTypes.string.isRequired,
    canAdd: PropTypes.string.isRequired,
};
