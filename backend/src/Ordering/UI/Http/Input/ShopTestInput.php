<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/** "Test connection" with the fields as typed (before saving); empty: the saved ones. */
final class ShopTestInput
{
    #[Assert\Length(max: 255)]
    public ?string $siteUrl = null;

    #[Assert\Length(max: 255)]
    public ?string $consumerKey = null;

    #[Assert\Length(max: 255)]
    public ?string $consumerSecret = null;
}
