<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Error\ShopDeliveryNotFound;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\ShopDeliveryRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineShopDeliveryRepository implements ShopDeliveryRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(ShopConnection $connection, int $id): ShopDelivery
    {
        return $this->em->getRepository(ShopDelivery::class)->findOneBy(['id' => $id, 'connection' => $connection]) ?? throw new ShopDeliveryNotFound();
    }

    public function add(ShopDelivery $delivery): void
    {
        $this->em->persist($delivery);
    }

    public function countFailed(ShopConnection $connection): int
    {
        return $this->em->getRepository(ShopDelivery::class)->count(['connection' => $connection, 'status' => ShopDelivery::STATUS_FAILED]);
    }

    public function purgeReceivedBefore(\DateTimeImmutable $before): int
    {
        return (int) $this->em->createQueryBuilder()
            ->delete(ShopDelivery::class, 'd')
            ->where('d.receivedAt < :before')
            ->setParameter('before', $before)
            ->getQuery()
            ->execute();
    }
}
