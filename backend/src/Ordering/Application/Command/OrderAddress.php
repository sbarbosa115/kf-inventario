<?php

namespace App\Ordering\Application\Command;

/**
 * One address of an order's customer. Its city, state and country are found by id, or created with the name when
 * no id is given (CustomerService::findOrCreateCity, as before).
 */
final readonly class OrderAddress
{
    public function __construct(
        public ?string $address,
        public ?string $zipCode,
        /** 1 billing, 2 shipping */
        public ?int $addressType,
        public ?int $cityId,
        public ?string $cityName,
        public ?int $stateId,
        public ?string $stateName,
        public ?int $countryId,
        public ?string $countryName,
    ) {
    }
}
