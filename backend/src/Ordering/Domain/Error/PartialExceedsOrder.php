<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Conflict;

/**
 * A partial shipment would ship more of a product than the order asked for, or the order was already sent whole.
 * (The legacy app saved it and then answered a 500.).
 */
final class PartialExceedsOrder extends Conflict
{
    public function __construct()
    {
        parent::__construct('partial_exceeds_order', 'This shipment exceeds what is left of the order.');
    }
}
