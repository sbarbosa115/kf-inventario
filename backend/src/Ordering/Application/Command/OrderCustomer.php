<?php

namespace App\Ordering\Application\Command;

/**
 * The customer an order is for, as the order form or a shop sends it: an existing one (by id, else by email, else
 * by phone) is updated with these values, otherwise one is created.
 */
final readonly class OrderCustomer
{
    /**
     * @param list<OrderAddress> $addresses the customer's addresses as they should be (they replace the ones it had)
     */
    public function __construct(
        public ?int $id,
        public ?string $firstName,
        public ?string $lastName,
        public ?string $email,
        public ?string $phone,
        public array $addresses,
    ) {
    }
}
