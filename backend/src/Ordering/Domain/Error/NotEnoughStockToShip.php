<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Refused;

/**
 * A shipment takes more of a product out of the warehouse than it holds (none at all when the warehouse never had it).
 * Same code and detail as Inventory's insufficient_stock, so the UI explains both alike. (The legacy app answered a
 * 500.).
 */
final class NotEnoughStockToShip extends Refused
{
    public function __construct(
        private readonly string $productCode,
        private readonly int $available,
    ) {
        parent::__construct('insufficient_stock', \sprintf('Only %d of "%s" in the warehouse.', $available, $productCode));
    }

    public function details(): array
    {
        return ['code' => $this->productCode, 'available' => $this->available];
    }
}
