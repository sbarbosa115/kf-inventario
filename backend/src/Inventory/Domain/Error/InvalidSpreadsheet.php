<?php

namespace App\Inventory\Domain\Error;

use App\Shared\Domain\Error\Refused;

/**
 * An uploaded stock spreadsheet that cannot be read.
 */
final class InvalidSpreadsheet extends Refused
{
    public function __construct(?\Throwable $previous = null)
    {
        parent::__construct('invalid_spreadsheet', 'The spreadsheet cannot be read.', $previous);
    }
}
