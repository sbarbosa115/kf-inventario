<?php

namespace App\Ordering\Application\Command;

final readonly class RotateShopWebhookSecret
{
    public function __construct(public int $id)
    {
    }
}
