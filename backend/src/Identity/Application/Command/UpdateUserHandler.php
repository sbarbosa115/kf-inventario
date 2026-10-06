<?php

namespace App\Identity\Application\Command;

use App\Identity\Application\Port\PasswordHasher;
use App\Identity\Domain\Error\UserNotFound;
use App\Identity\Domain\Repository\UserRepository;
use App\Shared\Application\Command\CommandHandler;

final class UpdateUserHandler implements CommandHandler
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly PasswordHasher $hasher,
    ) {
    }

    /**
     * @throws UserNotFound
     */
    public function __invoke(UpdateUser $command): void
    {
        $user = $this->users->get($command->id);
        $user->setName($command->name);
        $user->setUsername($command->username);
        $user->setEmail($command->email);
        $user->setRoles($command->roles);
        $user->setEnabled($command->enabled);
        if (null !== $command->plainPassword) {
            $user->setPassword($this->hasher->hash($user, $command->plainPassword));
        }
    }
}
