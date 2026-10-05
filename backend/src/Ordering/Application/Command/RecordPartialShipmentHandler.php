<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Domain\Error\NotEnoughStockToShip;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Error\PartialExceedsOrder;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderProduct;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * Legacy OrderService::createPartial. Shipping exactly what was ordered, with the warehouse holding enough of each
 * product, sends the whole order (status 5, the order's products taken out of stock). Anything else is a partial: a
 * child order holding these lines, the order's status 4, the lines taken out of the order's warehouse.
 *
 * Fixed on purpose (decision 9): a shipment that would exceed what was ordered, or one on an order already sent or
 * delivered, is refused (409) before anything is saved; the legacy code saved it and then answered a 500.
 */
final class RecordPartialShipmentHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderInventory $inventory,
        private readonly OrderWriter $writer,
    ) {
    }

    /**
     * @throws OrderNotFound|PartialExceedsOrder|NotEnoughStockToShip|OrderedProductNotFound|OrderWarehouseNotFound
     */
    public function __invoke(RecordPartialShipment $command): void
    {
        $order = $this->orders->get($command->orderId);
        if (\in_array($order->getStatus(), [Order::STATUS_SENT, Order::STATUS_DELIVERED], true)) {
            throw new PartialExceedsOrder();
        }
        $warehouse = $order->getWarehouse() ?? throw new OrderWarehouseNotFound();

        if ($this->warehouseHoldsTheWholeOrder($order) && self::shipsTheWholeOrder($order, $command->lines)) {
            $order->setStatus(Order::STATUS_SENT);
            $this->inventory->takeOut(self::linesOf($order), $warehouse);

            return;
        }

        $partial = new Order();
        $order->addChild($partial);
        $this->writer->addLines($partial, $command->lines);
        $order->setStatus(Order::STATUS_PARTIAL);
        try {
            $order->getPendingOrderProductsQuantities();
        } catch (\InvalidArgumentException) {
            throw new PartialExceedsOrder();
        }
        $this->orders->add($partial);
        $this->inventory->takeOut(self::linesOf($partial), $warehouse);
    }

    /**
     * OrderService::hasInventoryTheOrderRequiredProducts: no product of the order is short in its warehouse (a
     * product the warehouse has no row for is not checked here; taking it out refuses it).
     */
    private function warehouseHoldsTheWholeOrder(Order $order): bool
    {
        $stock = $this->inventory->stockOf($order);
        foreach ($order->getProducts() as $line) {
            foreach ($stock as $row) {
                if ($line->getProduct() === $row->getProduct() && $line->getQuantity() > $row->getQuantity()) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * OrderService::hasPartialOrderSameAmountOfProductsThatOriginal: every product of the order, in its exact quantity.
     *
     * @param list<OrderLine> $lines
     */
    private static function shipsTheWholeOrder(Order $order, array $lines): bool
    {
        $shipped = [];
        foreach ($lines as $line) {
            if (null !== $line->uuid && !isset($shipped[$line->uuid])) {
                $shipped[$line->uuid] = $line->quantity;
            }
        }

        foreach ($order->getProducts() as $line) {
            if (($shipped[$line->getUuid()] ?? null) !== $line->getQuantity()) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return list<OrderLine>
     */
    private static function linesOf(Order $order): array
    {
        return array_map(
            static fn (OrderProduct $line) => new OrderLine($line->getUuid(), $line->getProduct()?->getCode(), (int) $line->getQuantity()),
            $order->getOrderProducts()->getValues(),
        );
    }
}
