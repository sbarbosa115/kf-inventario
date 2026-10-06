<?php

namespace App\Ordering\Application\Command;

/**
 * Sends one shop_outbox row to its shop (docs/pdr/prd-shops-settings.md, Decisions 10): the message the `shops` queue
 * carries (ShopOutboxQueue), handled by the worker — the cron line on cPanel — when its time has come.
 */
final readonly class PushShopUpdate
{
    public function __construct(
        public int $outboxId,
    ) {
    }
}
