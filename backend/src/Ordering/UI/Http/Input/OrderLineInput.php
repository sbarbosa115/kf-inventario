<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A product of the order (by uuid, or by code) and how many.
 */
final class OrderLineInput
{
    public ?string $uuid = null;

    public ?string $code = null;

    #[Assert\Positive]
    public int $quantity = 0;
}
