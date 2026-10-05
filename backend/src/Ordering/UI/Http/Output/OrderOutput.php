<?php

namespace App\Ordering\UI\Http\Output;

use App\Customers\UI\Http\Output\CustomerRefOutput;
use App\Inventory\UI\Http\Output\WarehouseRefOutput;

/**
 * An order as the orders list shows it.
 */
final readonly class OrderOutput
{
    public function __construct(
        public int $id,
        public ?string $code,
        /** 1 created, 2 processed, 3 completed, 4 partial, 5 sent, 6 delivered */
        public int $status,
        /** 1 web (WooCommerce), 2 phone */
        public int $source,
        /** 1 credit card, 2 PayPal */
        public ?int $paymentMethod,
        public ?string $comment,
        /** ISO 8601 */
        public ?string $createdAt,
        public ?WarehouseRefOutput $warehouse,
        public ?CustomerRefOutput $customer,
        public int $commentsCount,
    ) {
    }
}
