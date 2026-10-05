<?php

namespace App\Customers\UI\Http\Input;

use App\Customers\Application\Command\AddressData;
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

    public function toData(): AddressData
    {
        return new AddressData($this->address, $this->zipCode, $this->addressType, $this->city?->toData());
    }
}
