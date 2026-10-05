<?php

namespace App\Customers\UI\Http\Input;

use App\Customers\Application\Command\SaveCustomer;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A customer and their addresses. With an id, that customer; otherwise found by email, then by phone, or created (CustomerRegistry).
 */
final class CustomerInput
{
    /** The validation group of the customers API itself (the default group is what every caller checks). */
    public const FORM = 'customer_form';

    public ?int $id = null;

    /** The customer form needs a name and an email; an order or invoice may name a customer by id alone. */
    #[Assert\NotBlank(groups: [self::FORM])]
    #[Assert\Length(max: 255)]
    public ?string $firstName = null;

    #[Assert\Length(max: 255)]
    public ?string $lastName = null;

    #[Assert\NotBlank(groups: [self::FORM])]
    #[Assert\Email]
    #[Assert\Length(max: 255)]
    public ?string $email = null;

    #[Assert\Length(max: 255)]
    public ?string $phone = null;

    /** @var list<AddressInput> */
    #[Assert\Valid]
    public array $addresses = [];

    /**
     * @param int|null $id the customer being edited, over any id in the body
     */
    public function toCommand(?int $id = null): SaveCustomer
    {
        return new SaveCustomer(
            $id ?? $this->id,
            $this->firstName,
            $this->lastName,
            $this->email,
            $this->phone,
            array_map(static fn (AddressInput $address) => $address->toData(), $this->addresses),
        );
    }
}
