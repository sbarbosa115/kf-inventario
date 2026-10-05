<?php

namespace App\Identity\Application\Port;

use App\Identity\Domain\Model\User;

/**
 * Turns a password someone typed into what the user table stores. The algorithm is the firewall's (bcrypt, so the
 * hashes already in the table keep working).
 */
interface PasswordHasher
{
    public function hash(User $user, string $plainPassword): string;
}
