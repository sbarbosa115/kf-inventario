<?php

namespace App\Tests\Unit\Controller;

use App\Entity\Product;
use App\Entity\ProductWarehouse;
use App\Tests\Unit\Utils\UserWebTestCase;
use Symfony\Component\HttpFoundation\Response;

class ProductControllerTest extends UserWebTestCase
{
    /**
     * @dataProvider getUrlsForRegularUsers
     */
    public function testOkByAllRoutes(string $httpMethod, string $url): void
    {
        $this->logIn();
        $this->client->request($httpMethod, $url);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
    }

    /**
     * @dataProvider getUrlsForRegularUsers
     */
    public function testOkByManageInventoryRole(string $httpMethod, string $url): void
    {
        $this->logIn(['ROLE_MANAGE_INVENTORY']);
        $this->client->request($httpMethod, $url);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
    }

    /**
     * @dataProvider getUrlsForRegularUsers
     */
    public function testOkByManageUserRole(string $httpMethod, string $url): void
    {
        $this->logIn(['ROLE_USER']);
        $this->client->request($httpMethod, $url);
        $this->assertSame(Response::HTTP_FORBIDDEN, $this->client->getResponse()->getStatusCode());
    }

    public function getUrlsForRegularUsers(): ?\Generator
    {
        yield ['GET', '/admin/product/'];
        yield ['GET', '/admin/product/upload'];
        yield ['GET', '/admin/product/all/1'];
        yield ['GET', '/admin/product/update/bar-code'];
        yield ['GET', '/admin/product/incoming'];
    }

    private function countProducts(): void
    {
        $products = $this->client->getContainer()
            ->get('doctrine')
            ->getRepository(Product::class)
            ->findAll();

        foreach ($products as $product) {
            dump($product->getCode());
        }
    }

    public function testMoveProductsBetweenWarehouses(): void
    {
        $quantityToMoveProductA = 20;
        $quantityToMoveProductB = 25;
        $warehouseSource = $this->getWarehouseByName('Colombia');
        $warehouseDestination = $this->getWarehouseByName('Usa');
        $productA = $this->findProductByCode('KF-01');
        $productB = $this->findProductByCode('KF-02');

        $productsToMove = [
            $productA->getUuid() => [
                'uuid' => $productA->getUuid(),
                'quantity' => $quantityToMoveProductA,
            ],
            $productB->getUuid() => [
                'uuid' => $productB->getUuid(),
                'quantity' => $quantityToMoveProductB,
            ],
        ];

        $this->logIn(['ROLE_MANAGE_INVENTORY']);
        $this->client->request('POST', "/admin/product/move/{$warehouseSource->getId()}/{$warehouseDestination->getId()}", [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode(['data' => $productsToMove]));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        //Checking products pending to approve on Destination Warehouse.
        $this->client->request('GET', "/admin/product/all/{$warehouseDestination->getId()}/".ProductWarehouse::STATUS_PENDING_TO_CONFIRM);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $serverResponse = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertCount(2, $serverResponse);
        //Testing destination product A
        $productAKeyOnServerResponse = array_search($productA->getUuid(), array_column($serverResponse, 'uuid'), true);
        $this->assertNotFalse($productAKeyOnServerResponse);
        $this->assertSame($quantityToMoveProductA, $serverResponse[$productAKeyOnServerResponse]['quantity']);

        //Testing destination product B
        $productBKeyOnServerResponse = array_search($productB->getUuid(), array_column($serverResponse, 'uuid'), true);
        $this->assertNotFalse($productBKeyOnServerResponse);
        $this->assertSame($quantityToMoveProductB, $serverResponse[$productBKeyOnServerResponse]['quantity']);

        // Approving products
        $this->client->request('POST', "/admin/product/incoming/approve/{$warehouseDestination->getId()}", [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode(['data' => $productsToMove]));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        //Checking the new quantities on destination warehouse, now the are confirmed.
        $this->client->request('GET', "/admin/product/all/{$warehouseDestination->getId()}");
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $serverResponse = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertCount(2, $serverResponse);
        //Testing destination product A
        $productAKeyOnServerResponse = array_search($productA->getUuid(), array_column($serverResponse, 'uuid'), true);
        $this->assertNotFalse($productAKeyOnServerResponse);
        $this->assertSame($quantityToMoveProductA, $serverResponse[$productAKeyOnServerResponse]['quantity']);

        //Testing destination product B
        $productBKeyOnServerResponse = array_search($productB->getUuid(), array_column($serverResponse, 'uuid'), true);
        $this->assertNotFalse($productBKeyOnServerResponse);
        $this->assertSame($quantityToMoveProductB, $serverResponse[$productBKeyOnServerResponse]['quantity']);

        //Checking new quantities on Destination Warehouse
        $this->client->request('GET', "/admin/product/all/{$warehouseSource->getId()}");
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $serverResponse = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertSame(80, $serverResponse[0]['quantity']);
        $this->assertSame(75, $serverResponse[1]['quantity']);
        $this->assertSame(100, $serverResponse[2]['quantity']);
    }
}
