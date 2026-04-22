<?php

namespace App\Tests\Unit\Controller;

use App\Tests\Unit\Utils\UserWebTestCase;
use Symfony\Component\HttpFoundation\Response;

class WarehouseControllerTest extends UserWebTestCase
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

    public function getUrlsForRegularUsers(): ?\Generator
    {
        yield ['GET', '/admin/warehouse/'];
        yield ['GET', '/admin/warehouse/edit/1'];
        yield ['GET', '/admin/warehouse/all'];
    }
}
