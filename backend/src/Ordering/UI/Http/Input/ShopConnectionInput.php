<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/** A shop connection as the form sends it. Blank keys keep the saved ones (PUT). */
final class ShopConnectionInput
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    public string $name = '';

    #[Assert\NotBlank]
    #[Assert\Url(requireTld: false)]
    #[Assert\Length(max: 255)]
    public string $siteUrl = '';

    #[Assert\Length(max: 255)]
    public ?string $consumerKey = null;

    #[Assert\Length(max: 255)]
    public ?string $consumerSecret = null;

    #[Assert\Positive]
    public int $warehouseId = 0;

    public bool $emailPrinter = false;

    public bool $active = true;

    /** @var array<string, bool> order_status, order_note */
    public array $capabilities = [];
}
