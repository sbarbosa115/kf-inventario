<?php

namespace App\Customers\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * One of a customer's addresses; an id edits an existing one.
 */
final class AddressInput
{
    public ?int $id = null;

    #[Assert\Length(max: 255)]
    public ?string $address = null;

    #[Assert\Length(max: 255)]
    public ?string $zipCode = null;

    public ?int $addressType = null;

    #[Assert\Valid]
    public ?CityInput $city = null;
}
