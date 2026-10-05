<?php

namespace App\Ordering\Infrastructure\Inventory;

use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Domain\Error\NotEnoughStockToShip;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Model\Order;
use Doctrine\ORM\EntityManagerInterface;

/**
 * The Inventory rules an order uses (legacy ProductService::removeProductsFromInventory, ProductWarehouseRepository::
 * getOrderProductsOnInventory, ProductUtils::builtQueryByUuidOrCode), on the Inventory models, in the caller's
 * transaction.
 *
 * Inventory's own Application services (item 2 of the restructure) were being built at the same time as this: once
 * they are merged, this adapter can delegate to them (docs/pdr/prd-restructure.md, "Ordering → Inventory").
 */
final class DoctrineOrderInventory implements OrderInventory
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function product(?string $uuid, ?string $code): Product
    {
        $criteria = null !== $uuid ? ['uuid' => $uuid] : (null !== $code ? ['code' => $code] : null);

        return (null === $criteria ? null : $this->em->getRepository(Product::class)->findOneBy($criteria))
            ?? throw new OrderedProductNotFound((string) ($uuid ?? $code));
    }

    public function warehouse(int $id): Warehouse
    {
        return $this->em->find(Warehouse::class, $id) ?? throw new OrderWarehouseNotFound();
    }

    public function warehouseOfShop(string $source): ?Warehouse
    {
        // As before: the last warehouse (by id) whose urls hold the address wins.
        $found = null;
        foreach ($this->em->getRepository(Warehouse::class)->findBy([], ['id' => 'ASC']) as $warehouse) {
            if (\in_array($source, $warehouse->getUrls(), false)) {
                $found = $warehouse;
            }
        }

        return $found;
    }

    public function stockOf(Order $order): array
    {
        $uuids = $order->getOrderProductsUuids();
        if ([] === $uuids || null === $order->getWarehouse()) {
            return [];
        }

        /** @var list<ProductWarehouse> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select('pw', 'p', 'w')
            ->from(ProductWarehouse::class, 'pw')
            ->innerJoin('pw.product', 'p')
            ->innerJoin('pw.warehouse', 'w')
            ->where('p.uuid IN (:uuids)')
            ->andWhere('w.id = :warehouse')
            ->setParameter('uuids', $uuids)
            ->setParameter('warehouse', $order->getWarehouse()->getId())
            ->orderBy('pw.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function takeOut(array $lines, Warehouse $warehouse): void
    {
        foreach ($lines as $line) {
            $criteria = null !== $line->uuid ? ['uuid' => $line->uuid] : ['code' => $line->code];
            $product = $this->em->getRepository(Product::class)->findOneBy($criteria);
            if (!$product instanceof Product) {
                continue;
            }

            $stock = $this->em->getRepository(ProductWarehouse::class)->findOneBy(['warehouse' => $warehouse, 'product' => $product]);
            if (!$stock instanceof ProductWarehouse || $stock->getQuantity() < $line->quantity) {
                throw new NotEnoughStockToShip((string) $product->getCode(), (int) $stock?->getQuantity());
            }

            $stock->subQuantity($line->quantity);
        }
    }
}
