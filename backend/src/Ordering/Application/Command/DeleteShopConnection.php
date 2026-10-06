<?php

namespace App\Ordering\Application\Command;

final readonly class DeleteShopConnection
{
    public function __construct(public int $id)
    {
    }
}
