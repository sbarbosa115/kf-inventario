<?php

namespace App\Ordering\Application\Port;

/**
 * Hands a shop_outbox row to the `shops` queue (the message carries only its id); the pusher sends it, retries it
 * and marks it failed after the last try (item 5b: PushShopUpdate on Messenger's `shops` transport).
 */
interface ShopOutboxQueue
{
    public function enqueue(int $outboxId): void;
}
