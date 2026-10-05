<?php

namespace App\Inventory\Application\Query;

use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Repository\ProductRepository;

/**
 * The products, as the product screens, the barcode reader, the stock spreadsheet and the order and invoice lines
 * (Ordering, Invoicing) read them.
 */
final class Products
{
    public function __construct(private readonly ProductRepository $products)
    {
    }

    /**
     * @throws ProductNotFound
     */
    public function byId(int $id): Product
    {
        return $this->products->get($id);
    }

    /**
     * @throws ProductNotFound
     */
    public function byUuid(string $uuid): Product
    {
        return $this->products->getByUuid($uuid);
    }

    /**
     * @throws ProductNotFound
     */
    public function byCode(string $code): Product
    {
        return $this->products->findByCode($code) ?? throw new ProductNotFound();
    }

    /**
     * A product named by its uuid when given, else by its code.
     *
     * @throws ProductNotFound
     */
    public function byUuidOrCode(?string $uuid, ?string $code): Product
    {
        return $this->products->getByUuidOrCode($uuid, $code);
    }

    /**
     * The rows of the stock spreadsheet: every product, or the selected ones (none: the empty template).
     *
     * @param list<string> $uuids
     *
     * @return list<Product>
     */
    public function forTemplate(bool $all, array $uuids): array
    {
        return $all ? $this->products->all() : $this->products->findByUuids($uuids);
    }
}
