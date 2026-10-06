<?php

namespace App\Ordering\Application\Port;

use App\Ordering\Application\Command\PlaceOrder;

/**
 * Turns a WooCommerce order (the webhook's body, or one order of the REST API: the same JSON) into the order to place.
 */
interface ShopOrderMapper
{
    /**
     * @param array<mixed> $shopOrder the decoded JSON
     *
     * @throws \UnexpectedValueException when it is not a WooCommerce order
     */
    public function toPlaceOrder(array $shopOrder, int $warehouseId, bool $notifyPrinter): PlaceOrder;
}
