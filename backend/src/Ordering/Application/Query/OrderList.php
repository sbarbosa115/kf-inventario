<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Domain\Model\Order;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * The orders list in the database (docs/pdr/prd-shops-settings.md, "List query contract"): a warehouse's orders
 * filtered, sorted and paged by the query, with the facet counts it asks for.
 */
interface OrderList
{
    /**
     * Each order with its customer and comments loaded.
     *
     * @return ListPage<Order>
     */
    public function page(int $warehouseId, ListQuery $query): ListPage;
}
