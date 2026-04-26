import React, { useState, useEffect } from 'react';
import Modal from 'react-bootstrap4-modal';
import ReactTable from 'react-table';
import PropTypes from 'prop-types';
import axios from 'axios';
import moment from 'moment';

export default function DetailOrder({ orderDetailId, closeModal }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [order, setOrder] = useState({});
  const [comments, setComments] = useState([]);

  useEffect(() => {
    axios.get(Routing.generate('order_detail', { order: orderDetailId })).then((response) => {
      setProducts(response.data.products);
      setOrder(response.data);
      setComments(response.data.comments);
      setLoading(false);
    });
  }, [orderDetailId]);

  const syncComments = (updated) => {
    axios.post(Routing.generate('order_sync_comments', { order: orderDetailId }), { comments: updated })
      .then(response => setComments(response.data.comments));
  };

  const getDefaultAddress = () => order.customer.addresses[0];

  const columns = [
    { Header: Translator.trans('product.template.code'), accessor: 'product.code', width: 100 },
    { Header: Translator.trans('product.template.description'), accessor: 'product.title' },
    { Header: Translator.trans('product.template.quantity'), accessor: 'quantity', width: 100 },
  ];

  return (
    <Modal dialogClassName="modal-lg" visible>
      <div className="modal-header">
        <h5 className="modal-title">{Translator.trans('order.index.detail')}</h5>
      </div>
      <div className="modal-body">
        {order.customer !== undefined && (
          <div className="row">
            <div className="col-md-12">
              <span>{Translator.trans('order.index.source')}{': '}<strong>{' '}{Translator.trans(`order_statuses.${order.source}`)}</strong></span>
              {' '}
              <span>{Translator.trans('order.index.status')}{': '}<strong>{' '}{Translator.trans(`order_statuses.${order.status}`)}</strong></span>
            </div>
            <div className="col-md-12">
              <span>{Translator.trans('order.index.customer')}{': '}<strong>{' '}{order.customer.firstName}{order.customer.lastName}</strong></span>
              {' '}
              <span>{Translator.trans('order.index.email')}{': '}<strong>{' '}{order.customer.email}</strong></span>
            </div>
            <div className="col-md-12">
              <span>{Translator.trans('order.index.code')}{': '}<strong>{' '}{order.code}</strong></span>
              {' '}
              <span>
                {Translator.trans('order.index.created_at')}{': '}
                <strong>{' '}{moment(order.createdAtAsString, ['YYYY-MM-DD HH:mm:ss']).format('MMMM D, YYYY')}</strong>
              </span>
            </div>
            <div className="col-md-12">
              <span>{Translator.trans('order.index.address')}{': '}<strong>{' '}{getDefaultAddress().address}</strong></span>
              {' '}
              <span>{Translator.trans('order.index.zip_code')}{': '}<strong>{' '}{getDefaultAddress().zipCode}</strong></span>
            </div>
            <div className="col-md-12">
              <span>{Translator.trans('order.index.city')}{': '}<strong>{' '}{getDefaultAddress().city.name}</strong></span>
              {' '}
              <span>{Translator.trans('order.index.state')}{': '}<strong>{' '}{getDefaultAddress().city.state.name}</strong></span>
              {' '}
              <span>{Translator.trans('order.index.country')}{': '}<strong>{' '}{getDefaultAddress().city.state.country.name}</strong></span>
            </div>
          </div>
        )}
        <hr />
        <ul className="nav nav-tabs" role="tablist">
          <li className="nav-item">
            <a className="nav-link active" id="products-detail-tab" data-toggle="tab" href="#products-detail" role="tab" aria-controls="home" aria-selected="true">
              {Translator.trans('order.index.order_products')}
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" id="order-detail-tab" data-toggle="tab" href="#order-comments" role="tab" aria-controls="profile" aria-selected="false">
              {Translator.trans('order.index.order_comments')}
            </a>
          </li>
        </ul>
        <div className="tab-content">
          <div className="tab-pane fade show active" id="products-detail" role="tabpanel" aria-labelledby="home-tab">
            <ReactTable data={products} columns={columns} defaultPageSize={5} loading={loading} />
          </div>
          <div className="tab-pane fade" id="order-comments" role="tabpanel" aria-labelledby="profile-tab">
            <hr />
            {comments.map(comment => (
              <div className="form-inline" key={comment.id}>
                <div className="form-group mb-2 col-md-10">
                  <textarea
                    defaultValue={comment.content}
                    className="form-control col-md-12"
                    onChange={(e) => { comment.content = e.target.value; }}
                  />
                </div>
                <button type="button" className="btn btn-sm btn-primary m-1" onClick={() => syncComments(comments)}>
                  <i className="fas fa-save" />
                </button>
                {' '}
                <button type="button" className="btn btn-sm btn-danger m-1" onClick={() => syncComments(comments.filter(c => c.id !== comment.id))}>
                  <i className="fas fa-times" />
                </button>
              </div>
            ))}
            <div className="col-md-12">
              <button type="button" className="btn btn-sm btn-success" onClick={() => syncComments([...comments, { id: null, content: null }])}>
                <i className="fas fa-plus" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <a href={Routing.generate('order_pdf_remaining', { order: order.id })} className="btn btn-info" target="_blank" rel="noopener noreferrer">
          <i className="fas fa-file-pdf" />{' '}{Translator.trans('order.index.download_remaining_order_products')}
        </a>
        <a href={Routing.generate('order_pdf', { order: order.id })} className="btn btn-success" target="_blank" rel="noopener noreferrer">
          <i className="fas fa-file-pdf" />{' '}{Translator.trans('order.index.download_order')}
        </a>
        <button type="button" className="btn btn-danger" onClick={closeModal}>
          {Translator.trans('close')}
        </button>
      </div>
    </Modal>
  );
}

DetailOrder.propTypes = {
  orderDetailId: PropTypes.number.isRequired,
  closeModal: PropTypes.func.isRequired,
};
