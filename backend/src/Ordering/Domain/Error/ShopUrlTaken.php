<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Conflict;

/** Another connection has this site URL (compared normalised): one connection per shop. */
final class ShopUrlTaken extends Conflict
{
    public function __construct()
    {
        parent::__construct('shop_url_taken', 'Another shop connection has this site URL.');
    }
}
