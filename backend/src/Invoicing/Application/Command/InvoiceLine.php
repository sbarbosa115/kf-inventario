<?php

namespace App\Invoicing\Application\Command;

/**
 * One line of an invoice to create. A product that exists gives the line its title as description; amounts are
 * decimal strings.
 */
final readonly class InvoiceLine
{
    public function __construct(
        public ?int $productId,
        public ?string $description,
        public int $quantity,
        public string $unitPrice,
        public ?string $discount,
    ) {
    }
}
