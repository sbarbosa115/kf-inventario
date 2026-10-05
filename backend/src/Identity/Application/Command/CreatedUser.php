<?php

namespace App\Identity\Application\Command;

use App\Identity\Domain\Model\User;

/**
 * What CreateUser answers. The table's key is assigned when the bus commits the transaction (after the handler
 * returns, handlers never flush), so the id is read from here once dispatch() has returned.
 */
final class CreatedUser
{
    public function __construct(private readonly User $user)
    {
    }

    public function id(): int
    {
        return (int) $this->user->getId();
    }
}
