<?php

namespace App\Invoicing\UI\Http\Input;

use App\Customers\UI\Http\Input\CustomerInput;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * An invoice created. The customer is an existing one (customer_id) or found or created from `customer`.
 */
final class InvoiceInput
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $code = '';

    #[Assert\Length(max: 100)]
    public ?string $paymentMethod = null;

    public ?int $customerId = null;

    #[Assert\Valid]
    public ?CustomerInput $customer = null;

    #[Assert\Length(max: 255)]
    public ?string $customerNit = null;

    public ?string $customerAddress = null;

    #[Assert\Regex('/^\d+(\.\d{1,2})?$/')]
    public ?string $taxRate = null;

    public ?string $comment = null;

    /** @var list<InvoiceItemInput> */
    #[Assert\Count(min: 1)]
    #[Assert\Valid]
    public array $items = [];
}
