<?php

namespace App\Invoicing\UI\Http\Output;

/**
 * The product an invoice line names, if any.
 */
final readonly class InvoiceProductOutput
{
    public function __construct(
        public int $id,
        public string $code,
    ) {
    }
}
