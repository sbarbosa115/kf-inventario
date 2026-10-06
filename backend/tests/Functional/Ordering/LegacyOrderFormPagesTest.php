<?php

namespace App\Tests\Functional\Ordering;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Routing\RouterInterface;

/**
 * The previous version's order form and getting-ready addresses (item 10): bookmarks land on the React screens with
 * the order's id, and the legacy route names still build the old addresses (the Twig orders list links them).
 */
final class LegacyOrderFormPagesTest extends ApiTestCase
{
    use SignsIn;

    public function testTheOldOrderFormAndGettingReadyPagesRedirectToTheNewScreens(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS', 'ROLE_USER']);

        $pages = [
            '/admin/order/new' => '/admin/orders/new',
            '/admin/order/edit/42' => '/admin/orders/42/edit',
            '/admin/order/partial/getting-ready/42' => '/admin/orders/42/getting-ready',
        ];
        foreach ($pages as $old => $new) {
            $this->client->request('GET', $old);

            $this->assertStatus(301, "{$old} is a bookmark worth keeping.");
            self::assertSame($new, parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH), "{$old} lands on its React screen, the order's id included.");
        }
    }

    public function testTheLegacyRouteNamesStillBuildTheOldAddresses(): void
    {
        /** @var RouterInterface $router */
        $router = self::getContainer()->get('router');

        self::assertSame('/admin/order/new', $router->generate('order_new'), 'The legacy orders list links the new-order page by this name.');
        self::assertSame('/admin/order/edit/42', $router->generate('order_edit', ['order' => 42]));
        self::assertSame('/admin/order/partial/getting-ready/42', $router->generate('order_getting_ready', ['order' => 42]));
    }

    public function testTheNewAddressesServeTheApp(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS', 'ROLE_USER']);

        foreach (['/admin/orders/new', '/admin/orders/42/edit', '/admin/orders/42/getting-ready'] as $page) {
            $this->client->request('GET', $page);

            $this->assertStatus(200, "{$page} is a page of the React app.");
            self::assertStringContainsString('text/html', (string) $this->client->getResponse()->headers->get('Content-Type'));
            self::assertStringNotContainsString('order-handler', (string) $this->client->getResponse()->getContent(), 'Not the legacy Twig form.');
        }
    }
}
