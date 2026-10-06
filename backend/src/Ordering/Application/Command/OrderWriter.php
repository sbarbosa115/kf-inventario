<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\CustomerBook;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Error\OrderWithoutProducts;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderProduct;
use App\Ordering\Domain\Repository\OrderRepository;

/**
 * Writes what the order form says onto an order, for PlaceOrder and UpdateOrder alike: the customer (found and updated
 * or created), the warehouse, the fields, and the product lines (the old ones removed, the new ones added).
 */
final class OrderWriter
{
    public function __construct(
        private readonly CustomerBook $customers,
        private readonly OrderInventory $inventory,
        private readonly OrderRepository $orders,
    ) {
    }

    /**
     * @throws OrderWithoutProducts|OrderedProductNotFound|OrderWarehouseNotFound
     */
    public function write(Order $order, OrderDetails $details): void
    {
        if ([] === $details->lines) {
            throw new OrderWithoutProducts();
        }

        $order->setCustomer($this->customers->addOrUpdate($details->customer));
        $order->setWarehouse($this->inventory->warehouse($details->warehouseId));
        // Order::setCode() takes a string; the legacy form could send none.
        $order->setCode((string) $details->code);
        $order->setSource($details->source);
        $order->setStatus($details->status);
        $order->setComment($details->comment);
        $order->setPaymentMethod($details->paymentMethod);

        foreach ($order->getOrderProducts()->toArray() as $line) {
            $order->getOrderProducts()->removeElement($line);
            $this->orders->removeLine($line);
        }
        $this->addLines($order, $details->lines);
    }

    /**
     * @param list<OrderLine> $lines
     *
     * @throws OrderedProductNotFound
     */
    public function addLines(Order $order, array $lines): void
    {
        foreach ($lines as $line) {
            $orderProduct = new OrderProduct();
            $orderProduct->setProduct($this->inventory->product($line->uuid, $line->code));
            $orderProduct->setQuantity($line->quantity);
            $order->addOrderProduct($orderProduct);
        }
    }

    /**
     * What the activity log keeps of an order.
     *
     * @return array<string, mixed>
     */
    public static function summary(Order $order): array
    {
        return [
            'id' => $order->getId(),
            'code' => $order->getCode(),
            'status' => $order->getStatus(),
            'source' => $order->getSource(),
            'paymentMethod' => $order->getPaymentMethod(),
            'comment' => $order->getComment(),
            'warehouse' => ['id' => $order->getWarehouse()?->getId(), 'name' => $order->getWarehouse()?->getName()],
            'customer' => ['id' => $order->getCustomer()?->getId(), 'email' => $order->getCustomer()?->getEmail()],
            'products' => array_map(static fn (OrderProduct $line) => ['uuid' => $line->getUuid(), 'quantity' => $line->getQuantity()], $order->getOrderProducts()->getValues()),
        ];
    }
}
