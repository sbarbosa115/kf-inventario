<?php

namespace App\Ordering\Application\Port;

/**
 * Which shop each order came from (shop_order_link), for the lists and details: `order.source` stays SOURCE_WEB, the
 * shop is the link (docs/pdr/prd-shops-settings.md, Decisions 9). Orders without a link (typed by hand, or imported
 * before connections existed) have none.
 */
interface ShopOrderLinks
{
    /**
     * @param list<int> $orderIds
     *
     * @return array<int, ShopRef> by order id
     */
    public function shopsOf(array $orderIds): array;
}
