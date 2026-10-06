<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Conflict;

final class ShopNameTaken extends Conflict
{
    public function __construct()
    {
        parent::__construct('shop_name_taken', 'Another shop connection has this name.');
    }
}
