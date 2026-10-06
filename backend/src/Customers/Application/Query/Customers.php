<?php

namespace App\Customers\Application\Query;

use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\Customer;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * Reads of customers, each with their addresses, cities, states and countries loaded.
 */
interface Customers
{
    /**
     * @throws CustomerNotFound
     */
    public function byId(int $id): Customer;

    /**
     * The customers list (docs/pdr/prd-shops-settings.md, "List query contract"): filtered, sorted and paged in the
     * database, with the country counts when asked for.
     *
     * @return ListPage<Customer>
     */
    public function list(ListQuery $query): ListPage;

    /**
     * Every customer, those without an address too.
     *
     * @return list<Customer>
     */
    public function all(): array;
}
