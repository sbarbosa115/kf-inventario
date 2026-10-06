<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Application\Port\ShopInbox;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineShopInbox implements ShopInbox
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function ofConnection(ShopConnection $connection): array
    {
        /** @var list<ShopDelivery> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select('d', 'o')
            ->from(ShopDelivery::class, 'd')
            ->leftJoin('d.order', 'o')
            ->where('d.connection = :connection')
            ->setParameter('connection', $connection)
            ->orderBy('d.receivedAt', \SortDirection::Descending)
            ->addOrderBy('d.id', \SortDirection::Descending)
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function removeOfConnection(ShopConnection $connection): void
    {
        $this->em->createQueryBuilder()
            ->delete(ShopDelivery::class, 'd')
            ->where('d.connection = :connection')
            ->setParameter('connection', $connection)
            ->getQuery()
            ->execute();
    }
}
