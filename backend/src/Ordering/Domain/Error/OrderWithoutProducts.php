<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Refused;

/**
 * An order names at least one product.
 */
final class OrderWithoutProducts extends Refused
{
    public function __construct()
    {
        parent::__construct('order_without_products', 'An order needs at least one product.');
    }
}
