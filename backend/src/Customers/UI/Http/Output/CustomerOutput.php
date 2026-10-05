<?php

namespace App\Customers\UI\Http\Output;

/**
 * A customer and their addresses.
 */
final readonly class CustomerOutput
{
    /**
     * @param list<AddressOutput> $addresses
     */
    public function __construct(
        public int $id,
        public ?string $firstName,
        public ?string $lastName,
        public ?string $email,
        public ?string $phone,
        public array $addresses,
    ) {
    }
}
