<?php

namespace App\Ordering\Application\Command;

/**
 * What a pull of one connection did. A shop that could not be read has an `error` (its own message, no keys); the
 * orders placed before it failed stay placed.
 */
final readonly class PulledShopOrders
{
    public function __construct(
        public int $connectionId,
        public string $name,
        /** Orders placed */
        public int $imported = 0,
        /** Orders the app already holds, or kept in the failed-deliveries inbox */
        public int $skipped = 0,
        public ?string $error = null,
    ) {
    }

    public function failed(): bool
    {
        return null !== $this->error;
    }
}
