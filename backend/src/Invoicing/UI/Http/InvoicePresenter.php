<?php

namespace App\Invoicing\UI\Http;

use App\Customers\UI\Http\Output\CustomerRefOutput;
use App\Invoicing\Domain\Model\Invoice;
use App\Invoicing\Domain\Model\InvoiceItem;
use App\Invoicing\UI\Http\Output\InvoiceItemOutput;
use App\Invoicing\UI\Http\Output\InvoiceOutput;
use App\Invoicing\UI\Http\Output\InvoiceProductOutput;

/**
 * Invoices as the API answers them (the Output DTOs of the route map).
 */
final class InvoicePresenter
{
    public function invoice(Invoice $invoice): InvoiceOutput
    {
        $customer = $invoice->getCustomer();

        return new InvoiceOutput(
            id: (int) $invoice->getId(),
            code: $invoice->getCode(),
            status: $invoice->getStatus(),
            customer: null === $customer ? null : new CustomerRefOutput((int) $customer->getId(), $customer->getFirstName(), $customer->getLastName(), $customer->getEmail(), $customer->getPhone()),
            customerNit: $invoice->getCustomerNit(),
            customerAddress: $invoice->getCustomerAddress(),
            comment: $invoice->getComment(),
            paymentMethod: $invoice->getPaymentMethod(),
            items: array_map(static fn (InvoiceItem $item) => new InvoiceItemOutput(
                id: (int) $item->getId(),
                description: $item->getDescription(),
                quantity: (int) $item->getQuantity(),
                unitPrice: (string) $item->getUnitPrice(),
                discount: $item->getDiscount(),
                total: (string) $item->getTotal(),
                product: null === $item->getProduct() ? null : new InvoiceProductOutput((int) $item->getProduct()->getId(), (string) $item->getProduct()->getCode()),
            ), $invoice->getItems()->getValues()),
            subtotal: $invoice->getSubtotal(),
            taxRate: $invoice->getTaxRate(),
            taxAmount: $invoice->getTaxAmount(),
            total: $invoice->getTotal(),
            createdAt: $invoice->getCreatedAt()?->format(\DATE_ATOM),
        );
    }
}
