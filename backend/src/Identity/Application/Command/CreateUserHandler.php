<?php

namespace App\Identity\Application\Command;

use App\Identity\Application\Port\PasswordHasher;
use App\Identity\Domain\Model\User;
use App\Identity\Domain\Repository\UserRepository;
use App\Shared\Application\Command\CommandHandler;

final class CreateUserHandler implements CommandHandler
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly PasswordHasher $hasher,
    ) {
    }

    public function __invoke(CreateUser $command): CreatedUser
    {
        $user = new User();
        $user->setName($command->name);
        $user->setUsername($command->username);
        $user->setEmail($command->email);
        $user->setRoles($command->roles);
        $user->setEnabled($command->enabled);
        $user->setPassword($this->hasher->hash($user, $command->plainPassword));
        $this->users->add($user);

        return new CreatedUser($user);
    }
}
