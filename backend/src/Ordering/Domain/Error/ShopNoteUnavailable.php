<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Refused;

/**
 * "Also send to the shop" on an order that cannot take a note: it did not come from a connection, or the connection
 * is inactive or has its order_note capability off (docs/pdr/prd-shops-settings.md, "Comments").
 */
final class ShopNoteUnavailable extends Refused
{
    public function __construct()
    {
        parent::__construct('shop_note_unavailable', "This order's shop does not take order notes from the app.");
    }
}
