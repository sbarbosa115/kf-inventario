<?php

namespace App\Inventory\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A warehouse renamed.
 */
final class WarehouseInput
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $name = '';
}
