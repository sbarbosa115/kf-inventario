<?php

namespace App\Invoicing\UI\Http\Output;

/**
 * One line of an invoice. Amounts are decimal strings.
 */
final readonly class InvoiceItemOutput
{
    public function __construct(
        public int $id,
        public ?string $description,
        public int $quantity,
        public string $unitPrice,
        public ?string $discount,
        public string $total,
        public ?InvoiceProductOutput $product,
    ) {
    }
}
