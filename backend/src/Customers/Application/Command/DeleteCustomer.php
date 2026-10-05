<?php

namespace App\Customers\Application\Command;

/**
 * Soft-deletes a customer (and, through the mapping, their orders). CustomerNotFound when there is none.
 */
final readonly class DeleteCustomer
{
    public function __construct(public int $id)
    {
    }
}
