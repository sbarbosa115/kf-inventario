<?php

namespace App\Identity\Application\Command;

/**
 * A new person who can sign in.
 */
final readonly class CreateUser
{
    /**
     * @param list<string> $roles
     */
    public function __construct(
        public string $name,
        public string $username,
        public string $email,
        public string $plainPassword,
        public array $roles,
        public bool $enabled,
    ) {
    }
}
