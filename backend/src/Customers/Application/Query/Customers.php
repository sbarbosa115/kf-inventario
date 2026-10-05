<?php

namespace App\Customers\Application\Query;

use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\Customer;

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
     * A page of customers by id, 1-based.
     *
     * @return list<Customer>
     */
    public function page(int $page, int $perPage): array;

    public function count(): int;

    /**
     * Every customer, those without an address too.
     *
     * @return list<Customer>
     */
    public function all(): array;
}
