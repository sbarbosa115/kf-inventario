<?php

namespace App\Ordering\UI\Http\Output;

/**
 * What "Check now" (POST /orders/sync over every active connection) brought in, per connection. Item 5b answers this
 * instead of SyncResultOutput.
 */
final readonly class ShopsSyncResultOutput
{
    /**
     * @param list<ShopSyncConnectionOutput> $connections
     */
    public function __construct(
        public int $imported,
        public int $skipped,
        /** Connections that could not be read */
        public int $failed,
        public array $connections,
    ) {
    }
}
