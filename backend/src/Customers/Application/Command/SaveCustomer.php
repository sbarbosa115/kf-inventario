<?php

namespace App\Customers\Application\Command;

/**
 * Creates or edits a customer and replaces their addresses (CustomerRegistry::addOrUpdate decides which: by id, else
 * by email, else by phone). Ordering and Invoicing build one of these for the customer they were handed.
 */
final readonly class SaveCustomer
{
    /**
     * @param list<AddressData> $addresses
     */
    public function __construct(
        public ?int $id,
        public ?string $firstName,
        public ?string $lastName,
        public ?string $email,
        public ?string $phone,
        public array $addresses = [],
    ) {
    }
}
