<?php

namespace App\Ordering\Application\Command;

/**
 * One address of an order's customer. Its city, state and country are found by id, else by name (a state or country
 * also by code), else created: Customers' rule (CustomerRegistry), which Ordering's CustomerBook delegates to.
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
        public ?string $stateCode = null,
        public ?string $countryCode = null,
    ) {
    }
}
