<?php

namespace App\Ordering\Domain\Event;

/**
 * An order's status changed (by hand, or by a shipment that sends it or leaves it partial). Handled after the commit
 * by the write-back to its shop (Application\EventHandler\PushOrderStatusToShop: docs/pdr/prd-shops-settings.md,
 * Decisions 10): Processed → processing, Sent and Delivered → completed.
 */
final readonly class OrderStatusChanged
{
    public function __construct(
        public int $orderId,
        public int $status,
    ) {
    }
}
