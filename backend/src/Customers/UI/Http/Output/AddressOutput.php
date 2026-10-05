<?php

namespace App\Customers\UI\Http\Output;

use App\Customers\Domain\Model\CustomerAddress;

/**
 * One of a customer's addresses.
 */
final readonly class AddressOutput
{
    public function __construct(
        public int $id,
        public ?string $address,
        public ?string $zipCode,
        /** 1: billing; 2: shipping (as the WooCommerce webhook stores them) */
        public ?int $addressType,
        public ?CityRefOutput $city,
    ) {
    }

    public static function of(CustomerAddress $address): self
    {
        $city = $address->getCity();
        $state = $city?->getState();
        $country = $state?->getCountry();

        return new self(
            $address->getId() ?? 0,
            $address->getAddress(),
            $address->getZipCode(),
            $address->getAddressType(),
            null === $city || null === $state || null === $country ? null : new CityRefOutput(
                $city->getId() ?? 0,
                (string) $city->getName(),
                new StateRefOutput(
                    $state->getId() ?? 0,
                    (string) $state->getName(),
                    $state->getCode(),
                    new CountryRefOutput($country->getId() ?? 0, (string) $country->getName(), $country->getCode()),
                ),
            ),
        );
    }
}
