<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * The status an order moves to.
 */
final class OrderStatusInput
{
    #[Assert\Choice(choices: [1, 2, 3, 4, 5, 6])]
    public int $status = 0;
}
