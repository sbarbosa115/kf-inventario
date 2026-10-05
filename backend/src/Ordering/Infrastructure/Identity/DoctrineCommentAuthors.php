<?php

namespace App\Ordering\Infrastructure\Identity;

use App\Identity\Domain\Model\User;
use App\Ordering\Application\Port\CommentAuthors;
use Doctrine\ORM\EntityManagerInterface;

/**
 * The signed-in user who writes a comment (a reference: the comment only needs its id).
 */
final class DoctrineCommentAuthors implements CommentAuthors
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $userId): User
    {
        return $this->em->getReference(User::class, $userId);
    }
}
