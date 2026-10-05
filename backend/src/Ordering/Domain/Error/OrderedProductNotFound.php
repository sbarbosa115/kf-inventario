<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

/**
 * An order line names a product (by uuid, or by code: a shop's SKU) that does not exist. Same code as Inventory's
 * own error, so the UI explains both alike.
 */
final class OrderedProductNotFound extends NotFound
{
    public function __construct(private readonly string $product)
    {
        parent::__construct('product_not_found', \sprintf('Product "%s" not found.', $product));
    }

    public function details(): array
    {
        return ['product' => $this->product];
    }
}
