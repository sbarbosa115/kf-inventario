<?php

namespace App\Inventory\Infrastructure\Persistence;

use App\Inventory\Domain\Error\StockNotFound;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\Domain\Repository\StockRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineStockRepository implements StockRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(Product $product, Warehouse $warehouse): ProductWarehouse
    {
        return $this->find($product, $warehouse) ?? throw new StockNotFound();
    }

    public function find(Product $product, Warehouse $warehouse): ?ProductWarehouse
    {
        return $this->em->getRepository(ProductWarehouse::class)->findOneBy(['product' => $product, 'warehouse' => $warehouse]);
    }

    public function findWithStatus(Product $product, Warehouse $warehouse, int $status): ?ProductWarehouse
    {
        return $this->em->getRepository(ProductWarehouse::class)->findOneBy(['product' => $product, 'warehouse' => $warehouse, 'status' => $status]);
    }

    public function ofWarehouse(Warehouse $warehouse, int $status): array
    {
        /** @var list<ProductWarehouse> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select('pw', 'p', 'w')
            ->from(ProductWarehouse::class, 'pw')
            ->innerJoin('pw.product', 'p')
            ->innerJoin('pw.warehouse', 'w')
            ->where('pw.warehouse = :warehouse')
            ->andWhere('pw.status = :status')
            ->setParameter('warehouse', $warehouse)
            ->setParameter('status', $status)
            ->orderBy('p.id', 'ASC')
            ->addOrderBy('pw.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function ofProducts(Warehouse $warehouse, array $uuids): array
    {
        if ([] === $uuids) {
            return [];
        }

        /** @var list<ProductWarehouse> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select('pw', 'p', 'w')
            ->from(ProductWarehouse::class, 'pw')
            ->innerJoin('pw.product', 'p')
            ->innerJoin('pw.warehouse', 'w')
            ->where('pw.warehouse = :warehouse')
            ->andWhere('p.uuid IN (:uuids)')
            ->setParameter('warehouse', $warehouse)
            ->setParameter('uuids', $uuids)
            ->orderBy('pw.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function add(ProductWarehouse $stock): void
    {
        $this->em->persist($stock);
    }

    public function remove(ProductWarehouse $stock): void
    {
        $this->em->remove($stock);
    }
}
