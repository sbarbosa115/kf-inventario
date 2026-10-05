<?php

namespace App\Tests\Unit\Inventory;

use App\Inventory\Domain\Error\InsufficientStock;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use PHPUnit\Framework\TestCase;

final class ProductWarehouseTest extends TestCase
{
    public function testSubtractingLessThanTheStockLeavesTheRest(): void
    {
        $stock = $this->stockOf('KF-01', 10);

        $stock->subQuantity(4);

        self::assertSame(6, $stock->getQuantity(), 'What is taken out leaves the warehouse.');
    }

    public function testSubtractingEverythingLeavesZero(): void
    {
        $stock = $this->stockOf('KF-01', 10);

        $stock->subQuantity(10);

        self::assertSame(0, $stock->getQuantity(), 'The whole stock may be taken out.');
    }

    public function testSubtractingMoreThanTheStockIsRefusedAndNamesWhatIsAvailable(): void
    {
        $stock = $this->stockOf('KF-01', 3);

        try {
            $stock->subQuantity(4);
            self::fail('A warehouse cannot give more than it holds.');
        } catch (InsufficientStock $e) {
            self::assertSame('insufficient_stock', $e->errorCode());
            self::assertSame(['code' => 'KF-01', 'available' => 3], $e->details(), 'The UI tells which product is short and how many there are.');
        }
        self::assertSame(3, $stock->getQuantity(), 'A refused subtraction changes nothing.');
    }

    public function testAddingNothingKeepsTheQuantity(): void
    {
        $stock = $this->stockOf('KF-01', 3);

        $stock->addQuantity(null);

        self::assertSame(3, $stock->getQuantity(), 'A spreadsheet row without a quantity adds zero.');
    }

    private function stockOf(string $code, int $quantity): ProductWarehouse
    {
        $product = new Product();
        $product->setCode($code);
        $stock = new ProductWarehouse();
        $stock->setProduct($product);
        $stock->setStatus(ProductWarehouse::STATUS_CONFIRMED);
        $stock->setQuantity($quantity);

        return $stock;
    }
}
