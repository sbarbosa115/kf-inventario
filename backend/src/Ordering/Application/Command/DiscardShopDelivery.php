<?php

namespace App\Ordering\Application\Command;

final readonly class DiscardShopDelivery
{
    public function __construct(
        public int $connectionId,
        public int $deliveryId,
    ) {
    }
}
