<?php

namespace App\Ordering\Application\Port;

/** What "Test connection" learns from a shop that answered. */
final readonly class StoreInfo
{
    public function __construct(
        public ?string $storeName,
        public ?string $wcVersion,
    ) {
    }
}
