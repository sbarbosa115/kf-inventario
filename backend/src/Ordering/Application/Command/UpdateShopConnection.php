<?php

namespace App\Ordering\Application\Command;

final readonly class UpdateShopConnection
{
    public function __construct(
        public int $id,
        public ShopConnectionDetails $details,
    ) {
    }
}
