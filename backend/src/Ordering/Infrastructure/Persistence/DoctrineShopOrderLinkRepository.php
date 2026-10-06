<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineShopOrderLinkRepository implements ShopOrderLinkRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function ofOrder(int $orderId): ?ShopOrderLink
    {
        return $this->ofOrders([$orderId])[$orderId] ?? null;
    }

    public function ofOrders(array $orderIds): array
    {
        if ([] === $orderIds) {
            return [];
        }
        /** @var list<ShopOrderLink> $links */
        $links = $this->em->createQueryBuilder()
            ->select('l', 'c')
            ->from(ShopOrderLink::class, 'l')
            ->join('l.connection', 'c')
            ->where('IDENTITY(l.order) IN (:ids)')
            ->setParameter('ids', $orderIds)
            ->getQuery()
            ->getResult();
        $byOrder = [];
        foreach ($links as $link) {
            $byOrder[(int) $link->order()->getId()] = $link;
        }

        return $byOrder;
    }

    public function byRemoteOrder(ShopConnection $connection, string $remoteOrderId): ?ShopOrderLink
    {
        return $this->em->getRepository(ShopOrderLink::class)->findOneBy(['connection' => $connection, 'remoteOrderId' => $remoteOrderId]);
    }

    public function hasLinks(ShopConnection $connection): bool
    {
        return null !== $this->em->getRepository(ShopOrderLink::class)->findOneBy(['connection' => $connection]);
    }

    public function add(ShopOrderLink $link): void
    {
        $this->em->persist($link);
    }
}
