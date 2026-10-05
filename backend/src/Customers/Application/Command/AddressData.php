<?php

namespace App\Customers\Application\Command;

/**
 * One address of a customer. Saving a customer replaces their whole address set, so an id is not looked up.
 */
final readonly class AddressData
{
    public function __construct(
        public ?string $address = null,
        public ?string $zipCode = null,
        public ?int $addressType = null,
        public ?CityData $city = null,
    ) {
    }
}
