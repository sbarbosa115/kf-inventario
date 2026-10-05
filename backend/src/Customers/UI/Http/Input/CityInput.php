<?php

namespace App\Customers\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * An address's city: an existing one by id, or a name to find or create in its state.
 */
final class CityInput
{
    public ?int $id = null;

    #[Assert\Length(max: 255)]
    public ?string $name = null;

    #[Assert\Valid]
    public ?StateInput $state = null;
}
