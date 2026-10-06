<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Repository\ShopDeliveryRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

final class PurgeShopDeliveriesHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopDeliveryRepository $deliveries,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @return int the rows deleted
     */
    public function __invoke(PurgeShopDeliveries $command): int
    {
        return $this->deliveries->purgeReceivedBefore($this->clock->now()->modify(\sprintf('-%d days', PurgeShopDeliveries::KEEP_DAYS)));
    }
}
