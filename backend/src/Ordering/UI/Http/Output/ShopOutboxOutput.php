<?php

namespace App\Ordering\UI\Http\Output;

/** A write to the shop (an order's status, an order note) and how it went. */
final readonly class ShopOutboxOutput
{
    /**
     * @param array<string, mixed> $payload
     */
    public function __construct(
        public int $id,
        /** order_status or order_note */
        public string $capability,
        public OrderRefOutput $order,
        public array $payload,
        /** pending, sent or failed */
        public string $status,
        public int $attempts,
        public ?string $lastError,
        /** ISO 8601 */
        public string $createdAt,
    ) {
    }
}
