<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Error\ShopOutboxNotFound;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineShopOutboxRepository implements ShopOutboxRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): ShopOutbox
    {
        return $this->em->find(ShopOutbox::class, $id) ?? throw new ShopOutboxNotFound();
    }

    public function add(ShopOutbox $entry): void
    {
        $this->em->persist($entry);
    }

    public function countFailed(ShopConnection $connection): int
    {
        return $this->em->getRepository(ShopOutbox::class)->count(['connection' => $connection, 'status' => ShopOutbox::STATUS_FAILED]);
    }

    public function ofConnection(ShopConnection $connection, string $status): array
    {
        return array_values($this->em->getRepository(ShopOutbox::class)->findBy(['connection' => $connection, 'status' => $status], ['id' => 'DESC']));
    }
}
