<?php

namespace App\Tests\Unit\Controller;

use App\Tests\Unit\Utils\UserWebTestCase;
use Symfony\Component\HttpFoundation\Response;

class UserControllerTest extends UserWebTestCase
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
        yield ['GET', '/admin/user/'];
        yield ['GET', '/admin/user/new'];
        yield ['GET', '/admin/user/edit/1'];
    }

    public function testCorrectRolesForUpdateOrderRoleOnIndex(): void
    {
        $this->logIn(['ROLE_MANAGE_USERS']);

        $crawler = $this->client->request('GET', '/admin/user/');
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $this->assertSame(1, $crawler->filter('.sidebar.navbar-nav > .nav-item')->count());
    }

    public function testCorrectRolesForAdminForOnIndex(): void
    {
        $this->logIn();

        $crawler = $this->client->request('GET', '/admin/user/');
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $this->assertSame(5, $crawler->filter('.sidebar.navbar-nav > .nav-item')->count());
    }
}
