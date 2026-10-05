<?php

namespace App\Inventory\Domain\Repository;

use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Model\Product;

interface ProductRepository
{
    /**
     * @throws ProductNotFound
     */
    public function get(int $id): Product;

    /**
     * @throws ProductNotFound
     */
    public function getByUuid(string $uuid): Product;

    public function findByCode(string $code): ?Product;

    /**
     * A product named by its uuid when the row has one, else by its code (how the stock moves, the barcode reader and
     * the order lines name a product).
     *
     * @throws ProductNotFound
     */
    public function getByUuidOrCode(?string $uuid, ?string $code): Product;

    /**
     * @param list<string> $uuids
     *
     * @return list<Product>
     */
    public function findByUuids(array $uuids): array;

    public function add(Product $product): void;
}
