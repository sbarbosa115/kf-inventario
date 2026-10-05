<?php

namespace App\Ordering\Application\Port;

use App\Customers\Domain\Model\Customer;
use App\Ordering\Application\Command\OrderCustomer;

/**
 * What Ordering needs from Customers: the order's customer, found and updated or created (the legacy
 * CustomerService::addOrUpdate rule: by id, else by email, else by phone; addresses replaced; cities, states and
 * countries found by id or created by name).
 */
interface CustomerBook
{
    public function addOrUpdate(OrderCustomer $customer): Customer;
}
