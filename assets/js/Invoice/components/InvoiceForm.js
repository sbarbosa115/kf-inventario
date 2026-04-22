import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function InvoiceForm({ url, locations = [], warehouses = [], customers = [] }) {
    const [items, setItems] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses.length ? warehouses[0].id : null);
    const [products, setProducts] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(customers.length ? customers[0].id : null);

    useEffect(() => {
        if (selectedWarehouse) {
            axios.get(Routing.generate('product_all', { status: 1, warehouse: selectedWarehouse }))
                .then(res => res.data)
                .then((result) => setProducts(result))
                .catch(() => setProducts([]));
        }
    }, [selectedWarehouse]);

    const [code, setCode] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');

    const addEmpty = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0 }] );

    const submit = () => {
        const payload = { code, paymentMethod, items, customer: selectedCustomer, warehouse: selectedWarehouse };
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(r => r.json())
            .then((data) => {
                if (data.status && data.invoice && data.invoice.id) {
                    window.open(Routing.generate('invoice_pdf', { invoice: data.invoice.id }), '_blank');
                } else {
                    console.log(data);
                }
            });
    };

    return (
        <div>
            <h4>{Translator.trans('invoice.new.title')}</h4>
            <div className="form-row mb-2">
                <div className="col-md-4">
                    <label>{Translator.trans('invoice.index.customer')}</label>
                    <select className="form-control" value={selectedCustomer || ''} onChange={e => setSelectedCustomer(e.target.value)}>
                        <option value="">--</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{`${c.firstName || ''} ${c.lastName || ''} [${c.email || ''}]`}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4">
                    <label>Warehouse</label>
                    <select className="form-control" value={selectedWarehouse || ''} onChange={e => setSelectedWarehouse(e.target.value)}>
                        <option value="">--</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4">
                    <label>Invoice #</label>
                    <input className="form-control" value={code} onChange={e => setCode(e.target.value)} />
                </div>
                <div className="col-md-4 text-right align-self-end">
                    <button className="btn btn-secondary" onClick={addEmpty}>Add line</button>
                    {' '}
                    <button className="btn btn-primary" onClick={submit}>Create Invoice</button>
                </div>
            </div>

            <div className="form-group">
                <label>Payment Method</label>
                <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="">--</option>
                    <option value="credit_counted">Credit - counted</option>
                    <option value="credit_card">Credit card - Paypal</option>
                </select>
            </div>

            <div>
                {items.map((it, idx) => (
                    <div key={idx} className="form-row" style={{marginTop:8}}>
                        <div className="col-md-5">
                            <input className="form-control" placeholder="Description" value={it.description} onChange={e => { const copy = [...items]; copy[idx].description = e.target.value; setItems(copy); }} />
                        </div>
                        <div className="col-md-2">
                            <input className="form-control" type="number" value={it.quantity} onChange={e => { const copy = [...items]; copy[idx].quantity = e.target.value; setItems(copy); }} />
                        </div>
                        <div className="col-md-3">
                            <input className="form-control" type="number" value={it.unitPrice} onChange={e => { const copy = [...items]; copy[idx].unitPrice = e.target.value; setItems(copy); }} />
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-danger" onClick={() => { const copy = items.filter((_,i) => i !== idx); setItems(copy); }}>Remove</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
