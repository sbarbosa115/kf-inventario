<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Ordering\Domain\Repository\ShopDeliveryRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/** Discard in the inbox: the admin decided the delivery will not be placed (a test order, one placed by hand). */
final class DiscardShopDeliveryHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopDeliveryRepository $deliveries,
        private readonly Clock $clock,
    ) {
    }

    public function __invoke(DiscardShopDelivery $command): void
    {
        $delivery = $this->deliveries->get($this->connections->get($command->connectionId), $command->deliveryId);
        if (ShopDelivery::STATUS_PLACED !== $delivery->status()) {
            $delivery->discard($this->clock->now());
        }
    }
}
