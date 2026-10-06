<?php

namespace App\Inventory\Application\Command;

/**
 * A product named by its uuid (when given) or else by its code, and a quantity of it.
 */
final readonly class StockLine
{
    public function __construct(
        public ?string $uuid,
        public ?string $code,
        public int $quantity,
    ) {
    }

    /**
     * @return array{uuid?: string, code?: string, quantity: int} as the legacy pages sent it (for the activity log)
     */
    public function toArray(): array
    {
        return array_filter(['uuid' => $this->uuid, 'code' => $this->code], static fn (?string $v): bool => null !== $v) + ['quantity' => $this->quantity];
    }
}
