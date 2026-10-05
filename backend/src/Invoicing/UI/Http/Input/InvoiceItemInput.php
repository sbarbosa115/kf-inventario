<?php

namespace App\Invoicing\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * One line of an invoice. Amounts are decimal strings.
 */
final class InvoiceItemInput
{
    public ?int $productId = null;

    #[Assert\Length(max: 255)]
    public ?string $description = null;

    #[Assert\Positive]
    public int $quantity = 0;

    #[Assert\NotBlank]
    #[Assert\Regex('/^\d+(\.\d{1,2})?$/')]
    public string $unitPrice = '0';

    #[Assert\Regex('/^\d+(\.\d{1,2})?$/')]
    public ?string $discount = null;
}
