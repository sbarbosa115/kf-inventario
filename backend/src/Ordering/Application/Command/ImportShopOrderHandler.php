<?php

namespace App\Ordering\Application\Command;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;
use Psr\Log\LoggerInterface;

/**
 * Legacy OrderController::createWebhook, for the legacy URL while its switch is on (docs/pdr/prd-shops-settings.md,
 * Decisions 8). A shop that already has a connection (its X-WC-Webhook-Source is the connection's site URL) is
 * imported through it: the connection's warehouse and printer switch, the link, its health. Any other shop as
 * before: the warehouse whose `urls` hold its address, placed like an order typed by hand, the printer only for the
 * printed warehouse (ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID). A delivery of an order the warehouse already has is logged
 * and places nothing (RemoteOrderKey). What cannot be placed — an unknown shop, a SKU that is no product — is logged,
 * as before, and kept in the inbox (kind `legacy`, with its body) instead of being lost.
 */
final class ImportShopOrderHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderInventory $inventory,
        private readonly ShopConnectionRepository $connections,
        private readonly ShopOrderImport $import,
        private readonly Clock $clock,
        private readonly LoggerInterface $logger,
        /** ordering.webhook_email_warehouse_id */
        private readonly int $printedWarehouseId,
    ) {
    }

    /**
     * @return int|null the new order's id; null when it was not placed (kept in the inbox, or already in the app)
     */
    public function __invoke(ImportShopOrder $command): ?int
    {
        $payload = $command->body ?? (string) json_encode($command->shopOrder);
        $source = null === $command->source ? '' : trim($command->source);
        if ([] === $command->shopOrder) {
            // A GET (WooCommerce checking the URL) or a body that is no JSON object: nothing to place or to keep.
            $this->logger->warning(\sprintf('WooCommerce delivery from [%s] carried no order: nothing placed.', $source));

            return null;
        }

        $connection = '' === $source ? null : $this->connections->bySiteUrl($source);
        if (null !== $connection) {
            $connection->recordWebhook($this->clock->now());
            if (!$connection->isActive()) {
                $this->import->keep($connection, ShopDelivery::KIND_LEGACY, self::remoteId($command->shopOrder), ShopDelivery::REASON_INACTIVE, 'The connection is inactive: activate it, then Retry.', $payload);

                return null;
            }

            $result = $this->import->import($connection, (int) $connection->warehouse()->getId(), $connection->emailsPrinter(), ShopDelivery::KIND_LEGACY, $command->shopOrder, $payload, $source);

            return $result->isPlaced() ? $result->orderId : null;
        }

        $warehouse = $this->warehouseOf($source);
        if (null === $warehouse) {
            $this->logger->error(\sprintf('Warehouse [%s] was not found', $command->source));
            $this->import->keep(null, ShopDelivery::KIND_LEGACY, self::remoteId($command->shopOrder), ShopDelivery::REASON_NO_WAREHOUSE, \sprintf('No connection and no warehouse receives the orders of [%s].', $source), $payload);

            return null;
        }

        $warehouseId = (int) $warehouse->getId();
        $result = $this->import->import(null, $warehouseId, $warehouseId === $this->printedWarehouseId, ShopDelivery::KIND_LEGACY, $command->shopOrder, $payload, $source);

        return $result->isPlaced() ? $result->orderId : null;
    }

    /**
     * The warehouse whose `urls` hold the shop's address: as written, then with and without the trailing slash
     * WooCommerce adds (home_url('/')).
     */
    private function warehouseOf(string $source): ?Warehouse
    {
        if ('' === $source) {
            return null;
        }
        $trimmed = rtrim($source, '/');

        return $this->inventory->warehouseOfShop($source)
            ?? $this->inventory->warehouseOfShop($trimmed)
            ?? $this->inventory->warehouseOfShop($trimmed.'/');
    }

    /**
     * @param array<mixed> $shopOrder
     */
    private static function remoteId(array $shopOrder): ?string
    {
        return \is_scalar($shopOrder['id'] ?? null) ? (string) $shopOrder['id'] : null;
    }
}
