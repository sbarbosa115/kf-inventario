<?php

namespace App\Ordering\Application\Command;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Port\ImportedOrderCodes;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Application\Port\RemoteOrderSource;
use App\Ordering\Application\Port\ShopOrderMapper;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderSyncFailed;
use App\Ordering\Domain\Error\OrderWithoutProducts;
use App\Shared\Application\Command\CommandHandler;
use Psr\Log\LoggerInterface;

/**
 * The "Sync Orders" button (the legacy one called a method that never existed): for each shop the app holds REST API
 * keys for, the warehouse that receives its webhooks gets the shop's waiting orders it does not have yet, each placed
 * exactly as the webhook places it (the same ShopOrderMapper and PlaceOrderHandler, the same printer rule).
 *
 * Idempotent: an order whose shop id is already an order code in that warehouse (RemoteOrderKey), deleted orders
 * included, is skipped. An order that cannot be placed (not a WooCommerce order, no lines, a SKU that is no product)
 * is skipped and logged, as the webhook logs it; it is checked before anything is written, so it leaves no customer
 * behind. A shop that cannot be read fails the whole sync (one transaction): nothing is kept and no email leaves.
 */
final class SyncRemoteOrdersHandler implements CommandHandler
{
    public function __construct(
        private readonly RemoteOrderSource $source,
        private readonly OrderInventory $inventory,
        private readonly ImportedOrderCodes $importedCodes,
        private readonly ShopOrderMapper $mapper,
        private readonly PlaceOrderHandler $placeOrder,
        private readonly LoggerInterface $logger,
        /** ordering.webhook_email_warehouse_id */
        private readonly int $printedWarehouseId,
    ) {
    }

    /**
     * @throws OrderSyncFailed
     */
    public function __invoke(SyncRemoteOrders $command): SyncedOrders
    {
        $imported = 0;
        $skipped = 0;

        foreach ($this->source->shops() as $shop) {
            $warehouse = $this->warehouseOf($shop);
            if (null === $warehouse) {
                $this->logger->warning(\sprintf('WooCommerce shop [%s] has REST API keys but no warehouse receives its orders: not pulled.', $shop));
                continue;
            }

            $warehouseId = (int) $warehouse->getId();
            $known = $this->knownKeys($warehouseId);
            foreach ($this->source->ordersOf($shop) as $remoteOrder) {
                $key = RemoteOrderKey::ofRemoteOrder($warehouseId, $remoteOrder);
                if (null !== $key && isset($known[(string) $key])) {
                    ++$skipped;
                    continue;
                }

                $placeOrder = $this->placeable($shop, $remoteOrder, $warehouseId);
                if (null === $placeOrder || null === $key) {
                    ++$skipped;
                    continue;
                }

                ($this->placeOrder)($placeOrder);
                $known[(string) $key] = true;
                ++$imported;
            }
        }

        return new SyncedOrders($imported, $skipped);
    }

    /**
     * The warehouse whose `urls` hold the shop's address. WooCommerce sends its webhook source with a trailing slash
     * (home_url('/')), and the keys may be written with or without it: both spellings are tried.
     */
    private function warehouseOf(string $shop): ?Warehouse
    {
        $trimmed = rtrim($shop, '/');

        return $this->inventory->warehouseOfShop($shop)
            ?? $this->inventory->warehouseOfShop($trimmed)
            ?? $this->inventory->warehouseOfShop($trimmed.'/');
    }

    /**
     * @return array<string, true>
     */
    private function knownKeys(int $warehouseId): array
    {
        $known = [];
        foreach ($this->importedCodes->of($warehouseId) as $code) {
            $key = RemoteOrderKey::ofOrder($warehouseId, $code);
            if (null !== $key) {
                $known[(string) $key] = true;
            }
        }

        return $known;
    }

    /**
     * The order to place, or null (logged) when it cannot be: checked before PlaceOrderHandler writes the customer.
     *
     * @param array<mixed> $remoteOrder
     */
    private function placeable(string $shop, array $remoteOrder, int $warehouseId): ?PlaceOrder
    {
        try {
            $placeOrder = $this->mapper->toPlaceOrder($remoteOrder, $warehouseId, $warehouseId === $this->printedWarehouseId);
            if ([] === $placeOrder->details->lines) {
                throw new OrderWithoutProducts();
            }
            foreach ($placeOrder->details->lines as $line) {
                $this->inventory->product($line->uuid, $line->code);
            }

            return $placeOrder;
        } catch (\UnexpectedValueException|OrderWithoutProducts|OrderedProductNotFound $e) {
            $id = $remoteOrder['id'] ?? null;
            $this->logger->error(\sprintf('WooCommerce order [%s] from [%s] was not placed: %s', \is_scalar($id) ? $id : '?', $shop, $e->getMessage()), ['exception' => $e]);

            return null;
        }
    }
}
