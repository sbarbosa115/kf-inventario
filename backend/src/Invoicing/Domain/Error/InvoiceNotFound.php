<?php

namespace App\Invoicing\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class InvoiceNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('invoice_not_found', 'Invoice not found.');
    }
}
