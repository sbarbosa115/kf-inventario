<?php

namespace App\Ordering\Application\Command;

/**
 * Deletes the failed-deliveries inbox rows received more than KEEP_DAYS days ago: they hold customers' data
 * (docs/pdr/prd-shops-settings.md, Security, "Inbox payloads"; Open questions, answer 3). Run by app:shops:pull.
 */
final readonly class PurgeShopDeliveries
{
    public const KEEP_DAYS = 90;
}
