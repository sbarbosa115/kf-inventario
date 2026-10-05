<?php

namespace App\Invoicing\Domain\Error;

use App\Shared\Domain\Error\Conflict;

/**
 * Another invoice already has this code. (The legacy app answered a 400 {status: false}.).
 */
final class InvoiceCodeTaken extends Conflict
{
    public function __construct()
    {
        parent::__construct('invoice_code_taken', 'Invoice code already exists.');
    }
}
