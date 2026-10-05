<?php

namespace App\Identity\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A user created or edited on the Users screen. A blank password keeps the current one (edit only).
 */
final class UserInput
{
    /** The roles the Users screen assigns (UserType's list). */
    public const ROLES = ['ROLE_ADMIN', 'ROLE_MANAGE_INVENTORY', 'ROLE_MANAGE_ORDERS', 'ROLE_UPDATE_ORDERS', 'ROLE_MANAGE_CUSTOMERS', 'ROLE_MANAGE_USERS', 'ROLE_MANAGE_WAREHOUSES', 'ROLE_CAN_READ_INVOICES', 'ROLE_CAN_CREATE_INVOICES'];

    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $name = '';

    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $username = '';

    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 255)]
    public string $email = '';

    #[Assert\Length(min: 6, max: 4096)]
    public ?string $password = null;

    /** @var list<string> */
    #[Assert\All(constraints: [new Assert\Choice(choices: self::ROLES)])]
    public array $roles = [];

    public bool $enabled = true;
}
