<?php

namespace App\Tests\Functional\Inventory;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;

/**
 * The previous version's product list and product form addresses (item 6): bookmarks land on the React screens, and
 * the legacy route names still build the links the Twig pages make with path().
 */
final class LegacyProductPagesTest extends ApiTestCase
{
    use SignsIn;

    private const UUID = '6f1c1a52-1111-4a8e-9a55-0123456789ab';

    public function testTheOldProductPagesRedirectToTheNewScreens(): void
    {
        $this->signInAs(['ROLE_MANAGE_INVENTORY']);

        $pages = [
            '/admin/product/' => '/admin/products',
            '/admin/product/new' => '/admin/products/new',
            '/admin/product/edit/'.self::UUID => '/admin/products/'.self::UUID.'/edit',
        ];
        foreach ($pages as $old => $new) {
            $this->client->request('GET', $old);

            $this->assertStatus(301, "{$old} is a bookmark worth keeping.");
            self::assertSame($new, parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH), "{$old} lands on its React screen, the product's uuid included.");
        }
    }

    public function testTheLegacyRouteNamesStillBuildTheOldAddresses(): void
    {
        /** @var RouterInterface $router */
        $router = self::getContainer()->get('router');

        self::assertSame('/admin/product/', $router->generate('product_product_index'), 'base.html.twig links the product list by this name, and the legacy upload redirects to it.');
        self::assertSame('/admin/product/new', $router->generate('product_new'));
        self::assertSame('/admin/product/edit/'.self::UUID, $router->generate('product_update', ['uuid' => self::UUID]));
        self::assertSame('/admin/products/'.self::UUID.'/edit', $router->generate('spa_product_edit', ['uuid' => self::UUID], UrlGeneratorInterface::ABSOLUTE_PATH));
    }

    public function testTheNewEditAddressServesTheApp(): void
    {
        $this->signInAs(['ROLE_MANAGE_INVENTORY']);

        $this->client->request('GET', '/admin/products/'.self::UUID.'/edit');

        $this->assertStatus(200, 'The redirect target is a page of the React app.');
        self::assertStringContainsString('text/html', (string) $this->client->getResponse()->headers->get('Content-Type'));
    }
}
