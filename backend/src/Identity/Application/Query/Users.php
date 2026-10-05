<?php

namespace App\Identity\Application\Query;

use App\Identity\Domain\Error\UserNotFound;
use App\Identity\Domain\Model\User;
use App\Identity\Domain\Repository\UserRepository;

/**
 * What the Users screen reads. Reads do not go through the command bus.
 */
final class Users
{
    public function __construct(private readonly UserRepository $users)
    {
    }

    /**
     * Every user, by name.
     *
     * @return list<User>
     */
    public function all(): array
    {
        return $this->users->all();
    }

    /**
     * @throws UserNotFound
     */
    public function get(int $id): User
    {
        return $this->users->get($id);
    }
}
