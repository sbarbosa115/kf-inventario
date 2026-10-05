<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\ImportedOrderCodes;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Application\Port\ShopOrderMapper;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWithoutProducts;
use App\Shared\Application\Command\CommandHandler;
use Psr\Log\LoggerInterface;

/**
 * Legacy OrderController::createWebhook: the order goes to the warehouse whose `urls` hold the shop's address and is
 * placed like one typed by hand; the printer gets it only when that warehouse is the printed one
 * (ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID, 1 as before). An unknown shop is logged and ignored. A delivery of an order the
 * warehouse already has (the sync's rule, RemoteOrderKey: the shop id is the code, deleted orders included) is logged
 * and places nothing: WooCommerce may deliver the same order twice.
 */
final class ImportShopOrderHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderInventory $inventory,
        private readonly ShopOrderMapper $mapper,
        private readonly PlaceOrderHandler $placeOrder,
        private readonly ImportedOrderCodes $importedCodes,
        private readonly LoggerInterface $logger,
        /** ordering.webhook_email_warehouse_id */
        private readonly int $printedWarehouseId,
    ) {
    }

    /**
     * @return int|null the new order's id; null when no warehouse receives this shop's orders, or it has this one
     *
     * @throws \UnexpectedValueException                   not a WooCommerce order
     * @throws OrderedProductNotFound|OrderWithoutProducts a SKU that is no product, an order without lines
     */
    public function __invoke(ImportShopOrder $command): ?int
    {
        $warehouse = null === $command->source ? null : $this->inventory->warehouseOfShop($command->source);
        if (null === $warehouse) {
            $this->logger->error(\sprintf('Warehouse [%s] was not found', $command->source));

            return null;
        }

        $warehouseId = (int) $warehouse->getId();
        $key = RemoteOrderKey::ofRemoteOrder($warehouseId, $command->shopOrder);
        if (null !== $key && $this->alreadyHas($key)) {
            $this->logger->info(\sprintf('WooCommerce order [%s] from [%s] is already in warehouse %d: not placed again.', $key->code, $command->source, $warehouseId));

            return null;
        }

        return ($this->placeOrder)($this->mapper->toPlaceOrder($command->shopOrder, $warehouseId, $warehouseId === $this->printedWarehouseId));
    }

    private function alreadyHas(RemoteOrderKey $key): bool
    {
        foreach ($this->importedCodes->of($key->warehouseId) as $code) {
            $known = RemoteOrderKey::ofOrder($key->warehouseId, $code);
            if (null !== $known && $known->equals($key)) {
                return true;
            }
        }

        return false;
    }
}
