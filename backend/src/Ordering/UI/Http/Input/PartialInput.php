<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * What is shipped now, per product.
 */
final class PartialInput
{
    /** @var list<OrderLineInput> */
    #[Assert\Count(min: 1)]
    #[Assert\Valid]
    public array $items = [];
}
