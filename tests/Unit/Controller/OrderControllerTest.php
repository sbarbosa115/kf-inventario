<?php

namespace App\Tests\Unit\Controller;

use App\Tests\Unit\Utils\UserWebTestCase;
use Symfony\Bundle\FrameworkBundle\Client;
use Symfony\Component\HttpFoundation\Response;

class OrderControllerTest extends UserWebTestCase
{
    /** @var Client */
    public $client;

    public function setUp(): void
    {
        $this->client = static::createClient();
    }

    /**
     * @dataProvider getUrlsForRoleUpdate
     */
    public function testOkByAllRoutes(string $httpMethod, string $url): void
    {
        $this->logIn(['ROLE_UPDATE_ORDERS']);
        $this->client->request($httpMethod, $url);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
    }

    /**
     * @dataProvider getUrlsForRoleUpdate
     */
    public function testForbiddenNoRol(string $httpMethod, string $url): void
    {
        $this->logIn(['ROLE_USER']);
        $this->client->request($httpMethod, $url);
        $this->assertSame(Response::HTTP_FORBIDDEN, $this->client->getResponse()->getStatusCode());
    }

    public function getUrlsForRoleUpdate(): ?\Generator
    {
        yield ['GET', '/admin/order/'];
        yield ['GET', '/admin/order/all/1'];
        yield ['GET', '/admin/order/new'];
    }

    public function testCorrectRolesForUpdateOrderRoleOnIndex(): void
    {
        $this->logIn(['ROLE_UPDATE_ORDERS']);

        $crawler = $this->client->request('GET', '/admin/order/');
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        $this->assertSame('', $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-can-delete'));
        $this->assertSame('', $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-can-sync'));
        $this->assertSame('1', $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-can-add'));

        $this->assertSame(1, $crawler->filter('.sidebar.navbar-nav > .nav-item')->count());
    }

    public function testCorrectRolesForAdminForOnIndex(): void
    {
        $this->logIn();

        $crawler = $this->client->request('GET', '/admin/order/');
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        $this->assertSame('1', $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-can-delete'));
        $this->assertSame('1', $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-can-sync'));
        $this->assertSame('1', $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-can-add'));

        $this->assertSame(5, $crawler->filter('.sidebar.navbar-nav > .nav-item')->count());
    }

    public function testAddEditAndRemoveAnOrder(): void
    {
        $orderCode = 'CREATED_USING_A_CONTROLLER_01';
        $this->logIn(['ROLE_MANAGE_ORDERS']);
        $productA = $this->createProduct(null, 'ADD-NEW-EDIT-KF-A');
        $productB = $this->createProduct(null, 'ADD-NEW-EDIT-KF-B');
        $productC = $this->createProduct(null, 'ADD-NEW-EDIT-KF-C');
        $originalOrder = $this->createOrderStructure([
            'code' => $orderCode,
            'products' => [
                ['uuid' => $productA->getUuid(), 'quantity' => 10],
                ['uuid' => $productB->getUuid(), 'quantity' => 20],
                ['uuid' => $productC->getUuid(), 'quantity' => 30],
            ],
        ]);

        $this->client->request('POST', '/admin/order/create', [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($originalOrder));

        $serverData = json_decode($this->client->getResponse()->getContent(), true);

        //Open the edit order page to get the data.
        $crawler = $this->client->request('GET', '/admin/order/edit/'.$serverData['order']);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $orderOnView = json_decode($crawler->filter('#order-handler')->getNode(0)->getAttribute('data-order'), true);

        foreach ($orderOnView['products'] as $product) {
            $productKey = array_search($product['uuid'], array_column($originalOrder['products'], 'uuid'), true);
            $this->assertNotNull($productKey);
            $this->assertSame($originalOrder['products'][$productKey]['quantity'], $product['quantity']);
        }

        $productD = $this->createProduct(null, 'ADD-NEW-EDIT-KF-D');
        $originalOrder['products'][0]['quantity'] = 11;
        unset($originalOrder['products'][1]);
        $originalOrder['products'][] = [
            'uuid' => $productD->getUuid(),
            'quantity' => 40,
        ];

        // Updating the created order with new products
        $this->client->request('POST', '/admin/order/update/'.$serverData['order'], [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($originalOrder));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        $crawler = $this->client->request('GET', '/admin/order/edit/'.$serverData['order']);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $orderOnView = json_decode($crawler->filter('#order-handler')->getNode(0)->getAttribute('data-order'), true);

        foreach ($orderOnView['products'] as $product) {
            foreach ($originalOrder['products'] as $originalOrderProduct) {
                if ($originalOrderProduct['uuid'] === $product['uuid']) {
                    $this->assertSame($originalOrderProduct['quantity'], $product['quantity']);
                }
            }
        }

        // Deleting created order
        //$this->logIn(['ROLE_CAN_DELETE_ORDERS']);
        $crawler = $this->client->request('GET', '/admin/order/');
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $token = $crawler->filter('#index-orders')->getNode(0)->getAttribute('data-token');

        $this->client->request('DELETE', '/admin/order/delete', [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode(['order' => $serverData['order'], 'token' => $token]));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        $this->client->request('GET', '/admin/order/edit/'.$serverData['order']);
        $this->assertSame(Response::HTTP_NOT_FOUND, $this->client->getResponse()->getStatusCode());
    }

    public function testPartialOrder(): void
    {
        //Create order
        //Go to the new method controller to partial it (create a new version with partial)
        $orderCode = 'PARTIAL_TESTING';
        $this->logIn(['ROLE_MANAGE_ORDERS']);
        $productA = $this->createProduct(null, 'ADD-NEW-EDIT-KF-A');
        $productB = $this->createProduct(null, 'ADD-NEW-EDIT-KF-B');
        $productC = $this->createProduct(null, 'ADD-NEW-EDIT-KF-C');
        $originalOrder = $this->createOrderStructure([
            'code' => $orderCode,
            'products' => [
                ['uuid' => $productA->getUuid(), 'quantity' => 10],
                ['uuid' => $productB->getUuid(), 'quantity' => 20],
                ['uuid' => $productC->getUuid(), 'quantity' => 30],
            ],
        ]);

        $this->client->request('POST', '/admin/order/create', [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($originalOrder));

        $partialOrder = [
            ['uuid' => $productA->getUuid(), 'quantity' => 5],
            ['uuid' => $productB->getUuid(), 'quantity' => 10],
        ];

        $serverData = json_decode($this->client->getResponse()->getContent(), true);
        $this->client->request('POST', '/admin/order/partial/'.$serverData['order'], [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($partialOrder));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $serverData = json_decode($this->client->getResponse()->getContent(), true);

        foreach ($serverData['pendingOrderProductQuantities'] as $pendingOrderProductQuantity) {
            $originalOrderProductKey = array_search($pendingOrderProductQuantity['uuid'], array_column($originalOrder['products'], 'uuid'), true);
            $partialOrderProductKey = array_search($pendingOrderProductQuantity['uuid'], array_column($partialOrder, 'uuid'), true);
            $pendingOrderProductKey = array_search($pendingOrderProductQuantity['uuid'], array_column($serverData['pendingOrderProductQuantities'], 'uuid'), true);

            if (false !== $partialOrderProductKey) {
                $remainingProductQuantity = $originalOrder['products'][$originalOrderProductKey]['quantity']
                    - $partialOrder[$partialOrderProductKey]['quantity'];
                $this->assertSame($serverData['productsAggregate'][$pendingOrderProductKey]['quantity'], $remainingProductQuantity);
            }
        }

        $this->client->request('GET', '/admin/order/partial/'.$serverData['order']);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        //Case completing a product with partial and to send the quantity twice
        $partialOrder = [
            ['uuid' => $productA->getUuid(), 'quantity' => 5],
            ['uuid' => $productB->getUuid(), 'quantity' => 10],
        ];
        $serverData = json_decode($this->client->getResponse()->getContent(), true);
        $this->client->request('POST', '/admin/order/partial/'.$serverData['order'], [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($partialOrder));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $serverData = json_decode($this->client->getResponse()->getContent(), true);

        //This request should thrown an exception o error, user is trying to add products to an order
        // Which are already completed
        $this->client->request('POST', '/admin/order/partial/'.$serverData['order'], [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($partialOrder));
        $this->assertSame(Response::HTTP_INTERNAL_SERVER_ERROR, $this->client->getResponse()->getStatusCode());
    }
}

