<?php

namespace App\Invoicing\UI\Http\Output;

use App\Customers\UI\Http\Output\CustomerRefOutput;

/**
 * An invoice and its lines. Amounts are decimal strings.
 */
final readonly class InvoiceOutput
{
    /**
     * @param list<InvoiceItemOutput> $items
     */
    public function __construct(
        public int $id,
        public ?string $code,
        public ?int $status,
        public ?CustomerRefOutput $customer,
        public ?string $customerNit,
        public ?string $customerAddress,
        public ?string $comment,
        public ?string $paymentMethod,
        public array $items,
        /** total minus tax_amount */
        public ?string $subtotal,
        public ?string $taxRate,
        public ?string $taxAmount,
        public ?string $total,
        /** ISO 8601 */
        public ?string $createdAt,
    ) {
    }
}
