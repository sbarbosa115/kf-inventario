<?php

namespace App\Inventory\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A product named by uuid or code, and a quantity.
 */
final class StockLineInput
{
    public ?string $uuid = null;

    public ?string $code = null;

    #[Assert\Positive]
    public int $quantity = 0;
}
