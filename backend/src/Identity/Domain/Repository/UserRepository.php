<?php

namespace App\Identity\Domain\Repository;

use App\Identity\Domain\Error\UserNotFound;
use App\Identity\Domain\Model\User;

interface UserRepository
{
    /**
     * @throws UserNotFound
     */
    public function get(int $id): User;

    public function findByUsername(string $username): ?User;

    public function add(User $user): void;
}
