<?php

namespace App\Inventory\Application\Command;

final readonly class UpdateProduct
{
    public function __construct(
        public string $uuid,
        public string $code,
        public string $title,
        public ?string $detail,
        public int $status,
        public ?float $price,
    ) {
    }
}
