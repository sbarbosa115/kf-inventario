<?php

namespace App\Ordering\Application\Command;

final readonly class CreateShopConnection
{
    public function __construct(public ShopConnectionDetails $details)
    {
    }
}
