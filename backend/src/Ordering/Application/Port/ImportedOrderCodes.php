<?php

namespace App\Ordering\Application\Port;

/**
 * The codes a warehouse's orders already carry, to tell a pulled shop order that is already in the app.
 */
interface ImportedOrderCodes
{
    /**
     * Every order code of the warehouse, deleted orders included: an order someone deleted is not brought back by the
     * next sync.
     *
     * @return list<string>
     */
    public function of(int $warehouseId): array;
}
