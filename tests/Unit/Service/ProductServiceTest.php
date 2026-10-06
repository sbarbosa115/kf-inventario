<?php

namespace App\Tests\Unit\Service;

use App\Entity\Product;
use App\Entity\ProductWarehouse;
use App\Entity\Warehouse;
use App\Services\ProductService;
use Symfony\Bundle\FrameworkBundle\Client;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ProductServiceTest extends WebTestCase
{
    /** @var $client Client */
    public $client;

    public function setUp(): void
    {
        $this->client = static::createClient();
    }

    public function createProduct(
        Warehouse $warehouse = null,
        string $code = 'CODE-TEST-01',
        int $quantity = 100
    ): Product {
        /** @var $productService ProductService */
        $productService = $this->client->getContainer()->get(ProductService::class);

        if (null === $warehouse) {
            $warehouse = $this->client->getContainer()->get('doctrine')
                ->getRepository(Warehouse::class)->findOneBy(['name' => 'Colombia']);
        }

        // Create product
        $products = [
            ['Code', 'Product Name', 'Description', 'Quantity', 'Price'],
            [$code, 'PRODUCT-TEST-NAME-01', 'DESCRIPTION-TEST-NAME-01', $quantity, '100'],
        ];
        $productService->storeProducts($products, $warehouse);

        /** @var $product Product */
        $product = $this->client->getContainer()->get('doctrine')
            ->getRepository(Product::class)
            ->findOneBy(['code' => $code]);

        return $product;
    }

    protected function getProductWarehouse(Product $product, Warehouse $warehouse): ProductWarehouse
    {
        return $this->client->getContainer()
            ->get('doctrine')
            ->getRepository(ProductWarehouse::class)
            ->findOneBy(['warehouse' => $warehouse, 'product' => $product]);
    }

    protected function getWarehouse(string $name = 'Colombia'): Warehouse
    {
        return $this->client->getContainer()->get('doctrine')
            ->getRepository(Warehouse::class)->findOneBy(['name' => $name]);
    }

    public function testStoreProducts(): void
    {
        //Warehouse taken from WarehouseFixtures.php
        /** @var $warehouse Warehouse */
        $warehouse = $this->getWarehouse();

        /** @var $productService ProductService */
        $productService = $this->client->getContainer()->get(ProductService::class);
        $products = [
            ['Code', 'Product Name', 'Description', 'Quantity', 'Price'],
            ['CODE-TEST-01', 'PRODUCT-TEST-NAME-01', 'DESCRIPTION-TEST-NAME-01', '100', '100'],
            ['CODE-TEST-01', 'PRODUCT-TEST-NAME-04', 'DESCRIPTION-TEST-NAME-04', '100', '100'],
        ];
        $productService->storeProducts($products, $warehouse);
        /** @var $productToWork Product */
        $product = $this->client->getContainer()->get('doctrine')
            ->getRepository(Product::class)
            ->findOneBy(['code' => 'CODE-TEST-01']);

        $this->assertInstanceOf(Product::class, $product);
    }

    public function testMoveProduct(): void
    {
        /** @var $productService ProductService */
        $productService = $this->client->getContainer()->get(ProductService::class);
        $warehouseSource = $this->getWarehouse();
        $warehouseDestination = $this->getWarehouse('Usa');

        // Create product
        $product = $this->createProduct($warehouseSource, 'TEST-MOVE-01');

        $dataPrepared = [
            ['uuid' => $product->getUuid(), 'quantity' => '40'],
        ];
        $productService->moveProducts($dataPrepared, $warehouseSource, $warehouseDestination);

        $productWarehouseSource = $this->getProductWarehouse($product, $warehouseSource);
        $this->assertNotNull($productWarehouseSource);
        $this->assertSame(60, $productWarehouseSource->getQuantity());

        $productWarehouseDestination = $this->getProductWarehouse($product, $warehouseDestination);
        $this->assertNotNull($productWarehouseDestination);
        $this->assertSame(40, $productWarehouseDestination->getQuantity());
    }

    public function testCaseUpdateQuantityExisting(): void
    {
        /** @var $productService ProductService */
        $productService = $this->client->getContainer()->get(ProductService::class);
        $warehouseSource = $this->getWarehouse();
        $warehouseDestination = $this->getWarehouse('Usa');

        $productToWork = $this->createProduct(null, 'CODE-TEST-99');

        $dataPrepared = [
            ['uuid' => $productToWork->getUuid(), 'quantity' => '50'],
        ];

        $productService->moveProducts($dataPrepared, $warehouseSource, $warehouseDestination);

        $productSource = $this->getProductWarehouse($productToWork, $warehouseSource);
        $productDestination = $this->getProductWarehouse($productToWork, $warehouseDestination);

        $this->assertSame(50, $productSource->getQuantity());
        $this->assertSame(50, $productDestination->getQuantity());
    }

    public function testMoveProducts(): void
    {
        /** @var $productService ProductService */
        $productService = $this->client->getContainer()->get(ProductService::class);
        $warehouse = $this->getWarehouse();
        $warehouseDestination = $this->getWarehouse('Usa');

        $productA = $this->createProduct($warehouse, 'CODE-TEST-02');
        $productB = $this->createProduct($warehouse, 'CODE-TEST-03');

        $dataPrepared = [
            ['code' => $productA->getCode(), 'quantity' => 10],
            ['code' => $productB->getCode(), 'quantity' => 20],
        ];
        $productService->addProductsToInventory($dataPrepared, $warehouse);

        $productWarehouseA = $this->getProductWarehouse($productA, $warehouse);
        $this->assertSame(110, $productWarehouseA->getQuantity());
        $productWarehouseB = $this->getProductWarehouse($productB, $warehouse);
        $this->assertSame(120, $productWarehouseB->getQuantity());

        $productService->moveProducts($dataPrepared, $warehouse, $warehouseDestination);

        $productWarehouseA = $this->getProductWarehouse($productA, $warehouseDestination);
        $this->assertSame(10, $productWarehouseA->getQuantity());
        $this->assertSame(ProductWarehouse::STATUS_PENDING_TO_CONFIRM, $productWarehouseA->getStatus());
        $productWarehouseB = $this->getProductWarehouse($productB, $warehouseDestination);
        $this->assertSame(20, $productWarehouseB->getQuantity());
        $this->assertSame(ProductWarehouse::STATUS_PENDING_TO_CONFIRM, $productWarehouseB->getStatus());
    }
}
