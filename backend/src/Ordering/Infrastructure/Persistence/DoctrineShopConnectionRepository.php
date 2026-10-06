<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Error\ShopConnectionNotFound;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineShopConnectionRepository implements ShopConnectionRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): ShopConnection
    {
        return $this->em->find(ShopConnection::class, $id) ?? throw new ShopConnectionNotFound();
    }

    public function byWebhookToken(string $token): ?ShopConnection
    {
        return '' === $token ? null : $this->em->getRepository(ShopConnection::class)->findOneBy(['webhookToken' => $token]);
    }

    public function byName(string $name): ?ShopConnection
    {
        return $this->em->getRepository(ShopConnection::class)->findOneBy(['name' => $name]);
    }

    public function bySiteUrl(string $siteUrl): ?ShopConnection
    {
        return $this->em->getRepository(ShopConnection::class)->findOneBy(['siteUrl' => ShopConnection::normaliseSiteUrl($siteUrl)]);
    }

    public function all(): array
    {
        return array_values($this->em->getRepository(ShopConnection::class)->findBy([], ['name' => 'ASC']));
    }

    public function active(): array
    {
        return array_values($this->em->getRepository(ShopConnection::class)->findBy(['active' => true], ['name' => 'ASC']));
    }

    public function add(ShopConnection $connection): void
    {
        $this->em->persist($connection);
    }

    public function remove(ShopConnection $connection): void
    {
        $this->em->remove($connection);
    }
}
