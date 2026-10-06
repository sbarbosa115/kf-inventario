<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class ShopDeliveryNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('delivery_not_found', 'Delivery not found.');
    }
}
