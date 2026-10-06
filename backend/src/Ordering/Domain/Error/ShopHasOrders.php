<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Conflict;

/** Orders came from this connection (they name it): it is deactivated, not deleted. */
final class ShopHasOrders extends Conflict
{
    public function __construct()
    {
        parent::__construct('shop_has_orders', 'Orders came from this shop connection: deactivate it instead.');
    }
}
