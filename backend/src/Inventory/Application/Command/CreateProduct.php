<?php

namespace App\Inventory\Application\Command;

final readonly class CreateProduct
{
    public function __construct(
        public string $code,
        public string $title,
        public ?string $detail,
        public int $status,
        public ?float $price,
    ) {
    }
}
