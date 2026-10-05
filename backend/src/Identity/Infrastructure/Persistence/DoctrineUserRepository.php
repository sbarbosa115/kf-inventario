<?php

namespace App\Identity\Infrastructure\Persistence;

use App\Identity\Domain\Error\UserNotFound;
use App\Identity\Domain\Model\User;
use App\Identity\Domain\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineUserRepository implements UserRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): User
    {
        return $this->em->find(User::class, $id) ?? throw new UserNotFound();
    }

    public function findByUsername(string $username): ?User
    {
        return $this->em->getRepository(User::class)->findOneBy(['username' => $username]);
    }

    public function add(User $user): void
    {
        $this->em->persist($user);
    }
}
