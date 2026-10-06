<?php

namespace App\Ordering\Application\Command;

final readonly class RetryShopDelivery
{
    public function __construct(
        public int $connectionId,
        public int $deliveryId,
    ) {
    }
}
