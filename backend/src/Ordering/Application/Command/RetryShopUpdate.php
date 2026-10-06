<?php

namespace App\Ordering\Application\Command;

/**
 * Retry from a connection's health: the outbox row is queued again, due now (docs/pdr/prd-shops-settings.md,
 * Decisions 10). A row already sent is left as it is.
 */
final readonly class RetryShopUpdate
{
    public function __construct(
        public int $connectionId,
        public int $outboxId,
    ) {
    }
}
