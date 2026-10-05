<?php

namespace App\Inventory\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Products and quantities to move, add or remove.
 */
final class StockLinesInput
{
    /** @var list<StockLineInput> */
    #[Assert\Count(min: 1)]
    #[Assert\Valid]
    public array $items = [];
}
