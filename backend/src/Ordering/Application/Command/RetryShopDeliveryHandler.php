<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Ordering\Domain\Repository\ShopDeliveryRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/**
 * Retry in the inbox (Decisions 7): the same import again from the stored body, now that the admin fixed the cause
 * (created the SKU, activated the connection, changed its warehouse). The row becomes `placed` with its order, or
 * stays `failed` with the new reason and one more attempt. A row without a body (a refused signature) cannot be
 * placed: it stays failed. Placed and discarded rows are left as they are.
 */
final class RetryShopDeliveryHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopDeliveryRepository $deliveries,
        private readonly ShopOrderImport $import,
        private readonly Clock $clock,
    ) {
    }

    public function __invoke(RetryShopDelivery $command): void
    {
        $connection = $this->connections->get($command->connectionId);
        $delivery = $this->deliveries->get($connection, $command->deliveryId);
        if (ShopDelivery::STATUS_FAILED !== $delivery->status()) {
            return;
        }
        $payload = $delivery->payload();
        if (null === $payload) {
            $delivery->failedAgain((string) $delivery->reasonCode(), $delivery->reason(), $this->clock->now());

            return;
        }
        if (!$connection->isActive()) {
            $delivery->failedAgain(ShopDelivery::REASON_INACTIVE, 'The connection is inactive: activate it, then Retry.', $this->clock->now());

            return;
        }

        $this->import->import($connection, (int) $connection->warehouse()->getId(), $connection->emailsPrinter(), $delivery->kind(), json_decode($payload, true), $payload, $connection->name(), $delivery);
    }
}
