<?php

namespace App\Ordering\Application\Command;

/**
 * What the order form says about an order: placed or edited, the same fields (legacy OrderService::setCustomerData
 * and syncProducts).
 */
final readonly class OrderDetails
{
    /**
     * @param list<OrderLine> $lines
     */
    public function __construct(
        public ?string $code,
        public int $status,
        public int $source,
        public ?int $paymentMethod,
        public ?string $comment,
        public int $warehouseId,
        public OrderCustomer $customer,
        public array $lines,
    ) {
    }
}
