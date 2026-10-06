<?php

namespace App\Ordering\Application\EventHandler;

use App\Ordering\Domain\Event\OrderStatusChanged;
use App\Shared\Application\Event\EventHandler;

/**
 * The write-back of an order's status to its shop. A no-op until shops-settings' item 5b (shops-sync-api) writes the
 * outbox row and queues PushShopUpdate here; it exists so that publishing OrderStatusChanged has a handler.
 */
final class PushOrderStatusToShop implements EventHandler
{
    public function __invoke(OrderStatusChanged $event): void
    {
    }
}
