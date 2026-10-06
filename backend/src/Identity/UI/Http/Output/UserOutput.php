<?php

namespace App\Identity\UI\Http\Output;

/**
 * A person who can sign in, as the Users screen lists and edits them (never the password).
 */
final readonly class UserOutput
{
    /**
     * @param list<string> $roles
     */
    public function __construct(
        public int $id,
        public string $name,
        public string $username,
        public ?string $email,
        /** The roles assigned (not the ones reached through the hierarchy) */
        public array $roles,
        public bool $enabled,
    ) {
    }
}
