<?php

namespace App\Customers\UI\Http\Output;

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
}
