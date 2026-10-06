<?php

namespace App\Inventory\Application\Query;

use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * The stock list in the database (docs/pdr/prd-shops-settings.md, "List query contract"): a warehouse's rows of one
 * status, filtered, sorted and paged by the query, and the figures over every row the filters keep.
 */
interface StockList
{
    /**
     * Each row with its product and warehouse loaded.
     *
     * @return ListPage<ProductWarehouse>
     */
    public function page(Warehouse $warehouse, int $status, ListQuery $query): ListPage;

    /**
     * The units (sum of the quantities) and their value (sum of quantity × price, rounded to cents) of every row the
     * query's filters keep, whatever its page.
     *
     * @return array{units: int, value: float}
     */
    public function totals(Warehouse $warehouse, int $status, ListQuery $query): array;
}
