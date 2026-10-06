<?php

namespace App\Customers\UI\Http\Output;

/**
 * A customer, named where an order or invoice points at it.
 */
final readonly class CustomerRefOutput
{
    public function __construct(
        public int $id,
        public ?string $firstName,
        public ?string $lastName,
        public ?string $email,
        public ?string $phone,
    ) {
    }
}
