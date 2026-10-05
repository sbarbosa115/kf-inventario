<?php

namespace App\Tests\Functional\Ordering;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

final class OrderRedirectsTest extends ApiTestCase
{
    use SignsIn;

    public function testTheOldOrderListRedirectsToTheNewScreen(): void
    {
        $this->signInAs(['ROLE_UPDATE_ORDERS', 'ROLE_USER']);

        $this->client->request('GET', '/admin/order/');

        $this->assertStatus(301, '/admin/order/ is a bookmark worth keeping.');
        self::assertSame('/admin/orders', parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH));
    }

    public function testTheLegacyNameOfTheOrderListStillBuildsItsAddress(): void
    {
        // base.html.twig (the Twig sidebar) and the legacy order form and getting-ready pages link to order_index.
        self::assertSame('/admin/order/', self::getContainer()->get('router')->generate('order_index'));
    }
}
