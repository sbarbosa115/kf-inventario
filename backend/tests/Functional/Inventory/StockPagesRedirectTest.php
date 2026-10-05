<?php

namespace App\Tests\Functional\Inventory;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The Twig pages of the stock screens are gone: their old addresses (bookmarks, the Twig sidebar) go to the SPA's.
 */
final class StockPagesRedirectTest extends ApiTestCase
{
    use SignsIn;

    public function testTheOldStockPagesRedirectToTheNewScreens(): void
    {
        $this->signInAs(['ROLE_MANAGE_INVENTORY', 'ROLE_MANAGE_WAREHOUSES']);

        $moved = [
            '/admin/product/upload' => '/admin/products/upload',
            '/admin/product/update/bar-code' => '/admin/products/barcode',
            '/admin/product/incoming' => '/admin/products/incoming',
            '/admin/warehouse/' => '/admin/warehouses',
            '/admin/warehouse/edit/3' => '/admin/warehouses',
        ];
        foreach ($moved as $old => $new) {
            $this->client->request('GET', $old);

            $this->assertStatus(301, "{$old} is a bookmark worth keeping.");
            self::assertSame($new, parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH));
        }
    }

    public function testTheDataActionsOtherLegacyPagesStillCallAreKept(): void
    {
        $this->signInAs(['ROLE_USER']);

        $this->client->request('GET', '/admin/warehouse/all');

        $this->assertStatus(200, 'the legacy order and product pages still read the warehouses from here.');
    }
}
