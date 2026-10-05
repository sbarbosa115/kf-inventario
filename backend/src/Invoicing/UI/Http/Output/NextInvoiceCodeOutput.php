<?php

namespace App\Invoicing\UI\Http\Output;

/**
 * The code the next invoice is offered.
 */
final readonly class NextInvoiceCodeOutput
{
    public function __construct(
        public string $code,
    ) {
    }
}
