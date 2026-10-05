<?php

namespace App\Inventory\Domain\Error;

use App\Shared\Domain\Error\Conflict;

/**
 * Stock moves between two different warehouses.
 */
final class SameWarehouse extends Conflict
{
    public function __construct()
    {
        parent::__construct('same_warehouse', 'Source and destination warehouse cannot be the same.');
    }
}
