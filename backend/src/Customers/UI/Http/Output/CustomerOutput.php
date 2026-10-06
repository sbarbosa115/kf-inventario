<?php

namespace App\Customers\UI\Http\Output;

use App\Customers\Domain\Model\Customer;

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

    public static function of(Customer $customer): self
    {
        return new self(
            $customer->getId() ?? 0,
            $customer->getFirstName(),
            $customer->getLastName(),
            $customer->getEmail(),
            $customer->getPhone(),
            array_values(array_map(AddressOutput::of(...), $customer->getAddresses()->toArray())),
        );
    }
}
