<?php

namespace App\Services;

use App\Entity\Comment;
use App\Entity\Order;
use App\Entity\User;
use App\Repository\CommentRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;

class CommentService
{
    private EntityManagerInterface $objectManager;

    private CommentRepository $commentRepo;

    public function __construct(
        EntityManagerInterface $objectManager,
        CommentRepository $commentRepo
    ) {
        $this->objectManager = $objectManager;
        $this->commentRepo = $commentRepo;
    }

    public function syncComments(array $comments, User $user, Order $order): void
    {
        $newComments = new ArrayCollection();
        $orderComments = $order->getComments();
        foreach ($comments as $commentItemKey => $commentItem) {
            if (null === $commentItem['id']) {
                $comment = new Comment();
                $comment->setUser($user);
                $comment->setOrder($order);
                $comment->setContent($commentItem['content']);
                $order->addComment($comment);
            } else {
                $comment = $this->commentRepo->find($commentItem['id']);
                if ($comment instanceof Comment) {
                    $comment->setContent($commentItem['content']);
                }
            }
            $newComments->add($comment);
            $this->objectManager->persist($comment);
        }

        foreach ($orderComments as $comment) {
            if (!$newComments->contains($comment)) {
                $order->removeComment($comment);
                $comment->setOrder(null);
            }
        }

        $this->objectManager->flush();
    }

    public function removeComments(Order $order): void
    {
        $comments = $order->getComments();
        foreach ($comments as $comment) {
            $order->removeComment($comment);
            $comment->setOrder(null);
            $this->objectManager->remove($comment);
        }
        $this->objectManager->flush();
    }

    public function getOrderComments(Order $order): array
    {
        $data = ['comments' => []];
        foreach ($order->getComments() as $comment) {
            $data['comments'][] = [
                'id' => $comment->getId(),
                'content' => $comment->getContent(),
            ];
        }

        return $data;
    }
}
