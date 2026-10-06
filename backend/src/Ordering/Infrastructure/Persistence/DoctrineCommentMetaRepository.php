<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineCommentMetaRepository implements CommentMetaRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function ofComment(int $commentId): ?OrderCommentMeta
    {
        return $this->ofComments([$commentId])[$commentId] ?? null;
    }

    public function ofComments(array $commentIds): array
    {
        if ([] === $commentIds) {
            return [];
        }
        /** @var list<OrderCommentMeta> $metas */
        $metas = $this->em->createQueryBuilder()
            ->select('m')
            ->from(OrderCommentMeta::class, 'm')
            ->where('IDENTITY(m.comment) IN (:ids)')
            ->setParameter('ids', $commentIds)
            ->getQuery()
            ->getResult();
        $byComment = [];
        foreach ($metas as $meta) {
            $byComment[(int) $meta->comment()->getId()] = $meta;
        }

        return $byComment;
    }

    public function pinnedOfOrders(array $orderIds): array
    {
        if ([] === $orderIds) {
            return [];
        }
        /** @var list<OrderCommentMeta> $metas */
        $metas = $this->em->createQueryBuilder()
            ->select('m', 'c')
            ->from(OrderCommentMeta::class, 'm')
            ->join('m.comment', 'c')
            ->where('m.pinned = true')
            ->andWhere('IDENTITY(c.order) IN (:ids)')
            ->setParameter('ids', $orderIds)
            ->getQuery()
            ->getResult();
        $byOrder = [];
        foreach ($metas as $meta) {
            $byOrder[(int) $meta->comment()->getOrder()?->getId()] = $meta;
        }

        return $byOrder;
    }

    public function byRemoteNote(ShopConnection $connection, string $remoteNoteId): ?OrderCommentMeta
    {
        return $this->em->getRepository(OrderCommentMeta::class)->findOneBy(['connection' => $connection, 'remoteNoteId' => $remoteNoteId]);
    }

    public function add(OrderCommentMeta $meta): void
    {
        $this->em->persist($meta);
    }
}
