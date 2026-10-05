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

    public function add(ProductWarehouse $stock): void
    {
        $this->em->persist($stock);
    }
}
