<?php

namespace App\Tests\Legacy\Controller;

use App\Tests\Legacy\Utils\UserWebTestCase;
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
        yield ['GET', '/admin/warehouse/all'];
    }
}
