<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class ShopConnectionNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('shop_not_found', 'Shop connection not found.');
    }
}
