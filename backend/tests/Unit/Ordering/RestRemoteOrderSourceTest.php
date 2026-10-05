<?php

namespace App\Tests\Unit\Ordering;

use App\Ordering\Domain\Error\OrderSyncFailed;
use App\Ordering\Infrastructure\WooCommerce\RestRemoteOrderSource;
use App\Shared\Domain\Clock;
use Automattic\WooCommerce\Client;
use Automattic\WooCommerce\HttpClient\HttpClientException;
use Automattic\WooCommerce\HttpClient\Request;
use Automattic\WooCommerce\HttpClient\Response;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * The WooCommerce REST adapter, with the client stubbed (no shop is called): the one set of keys the app has always
 * had (WOO_COMMERCE_URL/_API_KEY/_API_SECRET), the orders waiting to be fulfilled page by page, and a shop that
 * cannot be read becomes order_sync_failed.
 */
final class RestRemoteOrderSourceTest extends TestCase
{
    public function testWithoutAllThreeKeysTheAppReadsNoShop(): void
    {
        self::assertSame([], self::source('', 'ck', 'cs')->shops());
        self::assertSame([], self::source('https://shop.test', '', 'cs')->shops());
        self::assertSame([], self::source('https://shop.test', 'ck', ' ')->shops());
        self::assertSame(['https://shop.test'], self::source('https://shop.test', 'ck', 'cs')->shops(), 'One shop: the keys\' URL.');
    }

    public function testItAsksForTheLastThirtyDaysOfProcessingOrdersPageByPageAsArrays(): void
    {
        $queries = [];
        $client = $this->createMock(Client::class);
        $client->method('get')->willReturnCallback(static function (string $endpoint, array $query) use (&$queries) {
            $queries[] = [$endpoint, $query];

            // A full first page, then a short one: the last.
            return 1 === $query['page']
                ? array_map(static fn (int $id) => (object) ['id' => $id, 'billing' => (object) ['email' => 'a@b.c']], range(1, RestRemoteOrderSource::PER_PAGE))
                : [(object) ['id' => 101, 'line_items' => [(object) ['sku' => 'KF-01', 'quantity' => 1]]]];
        });

        $orders = self::source('https://shop.test', 'ck', 'cs', $client)->ordersOf('https://shop.test');

        self::assertCount(RestRemoteOrderSource::PER_PAGE + 1, $orders);
        self::assertSame(['id' => 101, 'line_items' => [['sku' => 'KF-01', 'quantity' => 1]]], $orders[100], 'The webhook mapper reads arrays, not the client\'s objects.');
        self::assertSame(['a@b.c'], [$orders[0]['billing']['email'] ?? null]);
        self::assertSame(
            [['orders', ['status' => 'processing', 'after' => '2026-09-05T10:00:00', 'orderby' => 'date', 'order' => 'asc', 'per_page' => 100, 'page' => 1]], ['orders', ['status' => 'processing', 'after' => '2026-09-05T10:00:00', 'orderby' => 'date', 'order' => 'asc', 'per_page' => 100, 'page' => 2]]],
            $queries,
        );
    }

    public function testAShopThatCannotBeReadIsOrderSyncFailed(): void
    {
        $client = $this->createMock(Client::class);
        $client->method('get')->willThrowException(new HttpClientException('Error: Consumer key is invalid. [woocommerce_rest_authentication_error]', 401, new Request(), new Response()));

        try {
            self::source('https://shop.test', 'ck', 'cs', $client)->ordersOf('https://shop.test');
            self::fail('A 401 from the shop must stop the sync.');
        } catch (OrderSyncFailed $e) {
            self::assertSame('order_sync_failed', $e->errorCode());
            self::assertStringNotContainsString('ck', $e->getMessage(), 'The answer never names the keys.');
        }
    }

    public function testAnAnswerThatIsNotAListOfOrdersIsOrderSyncFailed(): void
    {
        $client = $this->createMock(Client::class);
        $client->method('get')->willReturn((object) ['code' => 'rest_no_route']);

        $this->expectException(OrderSyncFailed::class);

        self::source('https://shop.test', 'ck', 'cs', $client)->ordersOf('https://shop.test');
    }

    private static function source(string $url, string $key, string $secret, ?Client $client = null): RestRemoteOrderSource
    {
        $clock = new class implements Clock {
            public function now(): \DateTimeImmutable
            {
                return new \DateTimeImmutable('2026-10-05T10:00:00');
            }
        };

        return new RestRemoteOrderSource($clock, new NullLogger(), $url, $key, $secret, null === $client ? null : static fn () => $client);
    }
}
