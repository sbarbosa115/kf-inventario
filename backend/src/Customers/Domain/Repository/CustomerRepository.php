<?php

namespace App\Customers\Domain\Repository;

use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\Customer;

interface CustomerRepository
{
    /**
     * A deleted customer (soft delete) is not found.
     *
     * @throws CustomerNotFound
     */
    public function get(int $id): Customer;

    public function findByEmail(string $email): ?Customer;

    public function findByPhone(string $phone): ?Customer;

    public function add(Customer $customer): void;

    /**
     * Soft-deletes the customer (Gedmo: deleted_at), as the legacy delete did.
     */
    public function remove(Customer $customer): void;
}
