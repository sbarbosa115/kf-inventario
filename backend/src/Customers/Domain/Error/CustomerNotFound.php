<?php

namespace App\Customers\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class CustomerNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('customer_not_found', 'Customer not found.');
    }
}
