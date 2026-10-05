<?php

namespace App\Inventory\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class StockNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('stock_not_found', 'The product has no stock in that warehouse.');
    }
}
