<?php

namespace App\Inventory\Infrastructure\Persistence;

use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Repository\ProductRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineProductRepository implements ProductRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): Product
    {
        return $this->em->find(Product::class, $id) ?? throw new ProductNotFound();
    }

    public function getByUuid(string $uuid): Product
    {
        return $this->em->getRepository(Product::class)->findOneBy(['uuid' => $uuid]) ?? throw new ProductNotFound();
    }

    public function findByCode(string $code): ?Product
    {
        return $this->em->getRepository(Product::class)->findOneBy(['code' => $code]);
    }

    public function getByUuidOrCode(?string $uuid, ?string $code): Product
    {
        $criteria = null !== $uuid ? ['uuid' => $uuid] : (null !== $code ? ['code' => $code] : null);
        if (null === $criteria) {
            throw new ProductNotFound();
        }

        return $this->em->getRepository(Product::class)->findOneBy($criteria) ?? throw new ProductNotFound();
    }

    public function findByUuids(array $uuids): array
    {
        if ([] === $uuids) {
            return [];
        }

        /** @var list<Product> $products */
        $products = $this->em->createQueryBuilder()
            ->select('p')
            ->from(Product::class, 'p')
            ->where('p.uuid IN (:uuids)')
            // One parameter per uuid: the legacy repository joined them into a single string (a list of one).
            ->setParameter('uuids', $uuids)
            ->getQuery()
            ->getResult();

        return $products;
    }

    public function add(Product $product): void
    {
        $this->em->persist($product);
    }
}
