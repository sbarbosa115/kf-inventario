<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Application\Port\ShopOrderMapper;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWithoutProducts;
use App\Shared\Application\Command\CommandHandler;
use Psr\Log\LoggerInterface;

/**
 * Legacy OrderController::createWebhook: the order goes to the warehouse whose `urls` hold the shop's address and is
 * placed like one typed by hand; the printer gets it only when that warehouse is the printed one
 * (ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID, 1 as before). An unknown shop is logged and ignored.
 */
final class ImportShopOrderHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderInventory $inventory,
        private readonly ShopOrderMapper $mapper,
        private readonly PlaceOrderHandler $placeOrder,
        private readonly LoggerInterface $logger,
        /** ordering.webhook_email_warehouse_id */
        private readonly int $printedWarehouseId,
    ) {
    }

    /**
     * @return int|null the new order's id; null when no warehouse receives this shop's orders
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

        return ($this->placeOrder)($this->mapper->toPlaceOrder($command->shopOrder, $warehouseId, $warehouseId === $this->printedWarehouseId));
    }
}
