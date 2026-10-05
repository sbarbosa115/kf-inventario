<?php

namespace App\Inventory\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A product created or edited (the legacy ProductType's fields and rules).
 */
final class ProductInput
{
    #[Assert\NotBlank]
    #[Assert\NotEqualTo('·')]
    #[Assert\NotEqualTo('CODE')]
    #[Assert\Length(max: 255)]
    public string $code = '';

    #[Assert\NotBlank]
    #[Assert\NotEqualTo('PRODUCT')]
    #[Assert\Length(max: 255)]
    public string $title = '';

    public ?string $detail = null;

    #[Assert\Choice(choices: [0, 1])]
    public int $status = 1;

    /** A whole number is a price too (the legacy form's NumberType took both). */
    #[Assert\PositiveOrZero]
    public int|float|null $price = null;
}
