<?php

namespace App\Ordering\Application\Command;

/** What became of one shop order: placed (its order), already in the app (nothing stored), or kept in the inbox. */
final readonly class ShopImportResult
{
    public const PLACED = 'placed';
    public const DUPLICATE = 'duplicate';
    public const FAILED = 'failed';

    private function __construct(
        public string $outcome,
        public ?int $orderId = null,
        public ?string $reasonCode = null,
    ) {
    }

    public static function placed(int $orderId): self
    {
        return new self(self::PLACED, $orderId);
    }

    public static function duplicate(?int $orderId): self
    {
        return new self(self::DUPLICATE, $orderId);
    }

    public static function failed(string $reasonCode): self
    {
        return new self(self::FAILED, reasonCode: $reasonCode);
    }

    public function isPlaced(): bool
    {
        return self::PLACED === $this->outcome;
    }
}
