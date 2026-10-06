<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class ShopOutboxNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('outbox_not_found', 'Outbox entry not found.');
    }
}
