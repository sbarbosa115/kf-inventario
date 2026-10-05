<?php

namespace App\Identity\UI\Http\Output;

use App\Identity\Domain\Model\User;

/**
 * Who is signed in. `roles` are every role the person holds through the role hierarchy (security.yaml), so the UI
 * shows exactly the menus and buttons the API will accept.
 */
final readonly class SessionOutput
{
    /**
     * @param list<string> $roles
     */
    public function __construct(
        public int $id,
        public string $username,
        public ?string $name,
        public ?string $email,
        public array $roles,
    ) {
    }

    /**
     * @param list<string> $reachableRoles
     */
    public static function from(User $user, array $reachableRoles): self
    {
        sort($reachableRoles);

        return new self((int) $user->getId(), (string) $user->getUsername(), $user->getName(), $user->getEmail(), $reachableRoles);
    }
}
