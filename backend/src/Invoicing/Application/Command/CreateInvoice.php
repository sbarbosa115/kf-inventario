<?php

namespace App\Invoicing\Application\Command;

use App\Customers\Application\Command\SaveCustomer;

/**
 * Creates an invoice. Its customer is an existing one (`customerId`) or the one found or created from `customer`
 * (Customers' rule: by id, else email, else phone); with neither, the invoice has none (a point-of-sale client).
 */
final readonly class CreateInvoice
{
    /**
     * @param list<InvoiceLine> $lines
     * @param string|null       $taxRate a percentage as a decimal string ("6" for 6 %)
     */
    public function __construct(
        public string $code,
        public ?string $paymentMethod,
        public ?int $customerId,
        public ?SaveCustomer $customer,
        public ?string $customerAddress,
        public ?string $taxRate,
        public ?string $comment,
        public array $lines,
    ) {
    }
}
