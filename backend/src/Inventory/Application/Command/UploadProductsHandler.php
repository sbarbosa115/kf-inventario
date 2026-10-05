<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Application\Port\ProductSheetReader;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Repository\ProductRepository;
use App\Inventory\Domain\Repository\StockRepository;
use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * The legacy ProductService::storeProducts, row by row: the header and rows without a code are skipped, and so is a
 * code already stored by an earlier row of the sheet. The product is found by code or created, and takes the row's
 * title (its code when empty), detail and price, and is active. Its stock row in the warehouse (any status) grows by
 * the row's quantity, or is created in stock. A row that breaks the product's rules (Product's NotEqualTo
 * constraints: code "·" or "CODE", title "PRODUCT") is not stored.
 */
final class UploadProductsHandler implements CommandHandler
{
    private const CODE = 0;
    private const TITLE = 1;
    private const DETAIL = 2;
    private const QUANTITY = 3;
    private const PRICE = 4;

    private const REFUSED_CODES = ['·', 'CODE'];
    private const REFUSED_TITLES = ['PRODUCT'];

    public function __construct(
        private readonly ProductSheetReader $sheets,
        private readonly WarehouseRepository $warehouses,
        private readonly ProductRepository $products,
        private readonly StockRepository $stock,
    ) {
    }

    /**
     * @return int how many rows were stored
     */
    public function __invoke(UploadProducts $command): int
    {
        $warehouse = $this->warehouses->get($command->warehouseId);
        $stored = [];

        foreach ($this->sheets->rows($command->path) as $index => $row) {
            $code = self::text($row[self::CODE] ?? null);
            if (0 === $index || null === $code || '' === $code || \in_array($code, $stored, true)) {
                continue;
            }
            $title = self::text($row[self::TITLE] ?? null) ?? $code;
            if (\in_array($code, self::REFUSED_CODES, true) || \in_array($title, self::REFUSED_TITLES, true)) {
                continue;
            }
            $quantity = (int) ($row[self::QUANTITY] ?? 0);

            $product = $this->products->findByCode($code);
            $isNew = null === $product;
            $product ??= new Product();
            $product->setStatus(Product::STATUS_ACTIVE);
            $product->setCode($code);
            $product->setTitle($title);
            $product->setPrice((float) ($row[self::PRICE] ?? 0));
            $product->setDetail(self::text($row[self::DETAIL] ?? null));

            $stockRow = $isNew ? null : $this->stock->find($product, $warehouse);
            if (null === $stockRow) {
                $stockRow = new ProductWarehouse();
                $stockRow->setProduct($product);
                $stockRow->setStatus(ProductWarehouse::STATUS_CONFIRMED);
                $stockRow->setQuantity(0);
                $stockRow->setWarehouse($warehouse);
                $product->addProductWarehouse($stockRow);
                $this->stock->add($stockRow);
            }
            $stockRow->addQuantity($quantity);

            if ($isNew) {
                $this->products->add($product);
            }
            $stored[] = $code;
        }

        return \count($stored);
    }

    private static function text(mixed $cell): ?string
    {
        return \is_scalar($cell) ? (string) $cell : null;
    }
}
