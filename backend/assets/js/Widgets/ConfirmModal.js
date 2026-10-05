import React from 'react';
import Modal from 'react-bootstrap4-modal';
import PropTypes from 'prop-types';

export default function ConfirmModal({ onOk, onCancel, children }) {
  return (
    <Modal dialogClassName="modal-md" visible>
      <div className="modal-header">
        <h5 className="modal-title">{Translator.trans('confirm')}</h5>
      </div>
      <div className="modal-body">
        {children}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={onOk}>
          {Translator.trans('confirm')}
        </button>
        <button type="button" className="btn btn-danger" onClick={onCancel}>
          {Translator.trans('close')}
        </button>
      </div>
    </Modal>
  );
}

ConfirmModal.propTypes = {
  onOk: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
