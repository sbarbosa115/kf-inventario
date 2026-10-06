<?php

namespace App\Tests\Functional\Inventory;

use App\Audit\Domain\Model\Log;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Tests\Support\ApiTestCase;

/**
 * Warehouses, products and stock rows for the Inventory API tests, saved in the test's transaction.
 *
 * @phpstan-require-extends ApiTestCase
 */
trait InventoryFixtures
{
    /**
     * @param list<string> $urls
     */
    protected function aWarehouse(string $name, array $urls = []): Warehouse
    {
        $warehouse = new Warehouse($name, $urls);
        $this->em()->persist($warehouse);
        $this->em()->flush();

        return $warehouse;
    }

    protected function aProduct(string $code, string $title = '', float $price = 10.0, ?string $detail = null): Product
    {
        $product = new Product();
        $product->setCode($code);
        $product->setTitle('' === $title ? 'Title '.$code : $title);
        $product->setDetail($detail);
        $product->setStatus(Product::STATUS_ACTIVE);
        $product->setPrice($price);
        $this->em()->persist($product);
        $this->em()->flush();

        return $product;
    }

    protected function aStock(Product $product, Warehouse $warehouse, int $quantity, int $status = ProductWarehouse::STATUS_CONFIRMED): ProductWarehouse
    {
        $stock = new ProductWarehouse();
        $stock->setProduct($product);
        $stock->setWarehouse($warehouse);
        $stock->setStatus($status);
        $stock->setQuantity($quantity);
        $this->em()->persist($stock);
        $this->em()->flush();

        return $stock;
    }

    /**
     * The stock rows of a product in a warehouse, read fresh from the database.
     *
     * @return list<array{status: int, quantity: int}>
     */
    protected function stockRows(Product $product, Warehouse $warehouse): array
    {
        $this->em()->clear();
        $rows = $this->em()->getRepository(ProductWarehouse::class)->findBy(['product' => $product->getId(), 'warehouse' => $warehouse->getId()], ['id' => 'ASC']);

        return array_map(static fn (ProductWarehouse $row): array => ['status' => (int) $row->getStatus(), 'quantity' => (int) $row->getQuantity()], $rows);
    }

    /**
     * @return list<string> the events of the activity log written for products
     */
    protected function productLogEvents(): array
    {
        $logs = $this->em()->getRepository(Log::class)->findBy(['entity' => 'product'], ['id' => 'ASC']);

        return array_map(static fn (Log $log): string => (string) $log->getEvent(), $logs);
    }
}
