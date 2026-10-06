<?php

namespace App\Ordering\Domain\Event;

/**
 * An order was placed, by hand or by a shop's webhook. Handled after the commit: the printer's email
 * (Application\EventHandler\SendOrderCreatedEmail), when the order asks for it.
 */
final readonly class OrderPlaced
{
    public function __construct(
        public int $orderId,
        /** By hand: always. From a shop: when its connection prints orders. */
        public bool $notifyPrinter,
    ) {
    }
}
