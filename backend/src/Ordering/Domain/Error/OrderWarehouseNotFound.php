<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

/**
 * The warehouse an order is placed in does not exist. Same code as Inventory's own error.
 */
final class OrderWarehouseNotFound extends NotFound
{
    public function __construct(?\Throwable $previous = null)
    {
        parent::__construct('warehouse_not_found', 'Warehouse not found.', $previous);
    }
}
