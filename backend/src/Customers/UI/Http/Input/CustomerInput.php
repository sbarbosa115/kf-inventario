<?php

namespace App\Customers\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A customer and their addresses. With an id, that customer; otherwise found by email, then by phone, or created (CustomerRegistry).
 */
final class CustomerInput
{
    public ?int $id = null;

    #[Assert\Length(max: 255)]
    public ?string $firstName = null;

    #[Assert\Length(max: 255)]
    public ?string $lastName = null;

    #[Assert\Email]
    #[Assert\Length(max: 255)]
    public ?string $email = null;

    #[Assert\Length(max: 255)]
    public ?string $phone = null;

    /** @var list<AddressInput> */
    #[Assert\Valid]
    public array $addresses = [];
}
