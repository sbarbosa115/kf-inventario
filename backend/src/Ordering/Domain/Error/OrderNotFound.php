<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class OrderNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('order_not_found', 'Order not found.');
    }
}
