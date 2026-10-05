<?php

namespace App\Inventory\Domain\Error;

use App\Shared\Domain\Error\Refused;

/**
 * A warehouse cannot give more of a product than it holds (a move, the barcode reader's remove, an order shipped).
 */
final class InsufficientStock extends Refused
{
    public function __construct(
        private readonly string $productCode,
        private readonly int $available,
    ) {
        parent::__construct('insufficient_stock', \sprintf('Only %d of %s are available.', $available, $productCode));
    }

    /**
     * @return array{code: string, available: int}
     */
    public function details(): array
    {
        return ['code' => $this->productCode, 'available' => $this->available];
    }
}
