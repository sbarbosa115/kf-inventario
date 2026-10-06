<?php

namespace App\Ordering\UI\Http\Output;

/** What "Check now" did on one connection. */
final readonly class ShopSyncConnectionOutput
{
    public function __construct(
        public int $id,
        public string $name,
        public int $imported,
        public int $skipped,
        /** Why the shop could not be read; null when it was */
        public ?string $error,
    ) {
    }
}
