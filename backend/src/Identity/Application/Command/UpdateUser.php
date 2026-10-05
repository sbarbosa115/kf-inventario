<?php

namespace App\Identity\Application\Command;

/**
 * Edits a user. A null password keeps the current one.
 */
final readonly class UpdateUser
{
    /**
     * @param list<string> $roles
     */
    public function __construct(
        public int $id,
        public string $name,
        public string $username,
        public string $email,
        public ?string $plainPassword,
        public array $roles,
        public bool $enabled,
    ) {
    }
}
