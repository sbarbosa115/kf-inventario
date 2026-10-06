<?php

namespace App\Tests\Unit\Ordering;

use App\Ordering\Application\Port\ShopCredentials;
use App\Ordering\Domain\Error\ShopUnreachable;
use App\Ordering\Infrastructure\WooCommerce\SafeShopHttp;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\RequestInterface;

/**
 * The SSRF guard every call to a shop goes through (docs/pdr/prd-shops-settings.md, Security): https only (http in
 * dev), no host that is or resolves to a loopback, private, link-local, multicast or reserved address, the address
 * checked is the address connected to (pinned), no redirect followed, 15 s, and only /wp-json/wc/v3 paths the app
 * builds. No network: the resolver and the HTTP handler are stubbed.
 */
final class SafeShopHttpTest extends TestCase
{
    /**
     * @return iterable<string, array{string}>
     */
    public static function blockedAddresses(): iterable
    {
        foreach (['127.0.0.1', '127.8.8.8', '10.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.1', '169.254.169.254', '224.0.0.1', '239.1.2.3', '0.0.0.0', '100.64.0.1', '240.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'] as $ip) {
            yield $ip => [$ip];
        }
    }

    #[DataProvider('blockedAddresses')]
    public function testAHostThatIsOrResolvesToAnInternalAddressIsRefused(string $ip): void
    {
        $literal = str_contains($ip, ':') ? '['.$ip.']' : $ip;

        self::assertNotNull(self::http()->refusal('https://'.$literal), "https://{$literal} is an internal address.");
        self::assertNotNull(self::http(resolve: static fn () => [$ip])->refusal('https://shop.example.com'), "A name that resolves to {$ip} is refused too.");
    }

    public function testAPublicHttpsShopIsAllowed(): void
    {
        self::assertNull(self::http(resolve: static fn () => ['93.184.216.34'])->refusal('https://shop.example.com/store'));
        self::assertNull(self::http()->refusal('https://93.184.216.34'));
        self::assertNull(self::http()->refusal('https://[2606:2800:220:1:248:1893:25c8:1946]'));
        self::assertNotNull(self::http(resolve: static fn () => ['93.184.216.34', '10.0.0.9'])->refusal('https://shop.example.com'), 'One internal address among several is enough to refuse.');
    }

    public function testPlainHttpOnlyInDevAndTheDevStacksOwnHostOnlyThere(): void
    {
        $public = static fn () => ['93.184.216.34'];
        $nginx = static fn () => ['172.18.0.5'];

        self::assertNotNull(self::http('prod', $public)->refusal('http://shop.example.com'));
        self::assertNotNull(self::http('test', $public)->refusal('http://shop.example.com'));
        self::assertNull(self::http('dev', $public)->refusal('http://shop.example.com'));
        self::assertNull(self::http('dev', $nginx)->refusal('http://nginx/_fake-shop'), 'The dev stack\'s fake shop.');
        self::assertNotNull(self::http('prod', $nginx)->refusal('https://nginx/_fake-shop'));
        self::assertNotNull(self::http('dev', $nginx)->refusal('http://other-container'), 'Only the named dev hosts.');
        self::assertNotNull(self::http('dev')->refusal('ftp://shop.example.com'));
        self::assertNotNull(self::http('dev')->refusal('not a url'));
    }

    public function testAnUnresolvableHostIsAcceptedAtSaveButNotCalled(): void
    {
        $http = self::http(resolve: static fn () => [], handler: new MockHandler([new Response(200, [], '[]')]));

        self::assertNull($http->refusal('https://not-yet-live.example.com'), 'A shop whose DNS is not live yet can be saved.');
        $this->expectException(ShopUnreachable::class);
        $http->api(self::credentials('https://not-yet-live.example.com'), 'GET', 'orders');
    }

    public function testARedirectIsNotFollowed(): void
    {
        $handler = new MockHandler([new Response(302, ['Location' => 'http://169.254.169.254/latest/meta-data']), new Response(200, [], '[]')]);
        $http = self::http(resolve: static fn () => ['93.184.216.34'], handler: $handler);

        try {
            $http->api(self::credentials(), 'GET', 'orders');
            self::fail('A redirect must not be followed.');
        } catch (ShopUnreachable $e) {
            self::assertSame(302, $e->httpStatus());
            self::assertStringContainsString('redirect', $e->reason());
        }
        self::assertSame(1, $handler->count(), 'The second answer (where the redirect led) was never asked for.');
    }

    public function testTheCallIsPinnedToTheCheckedAddressWithTheKeysAndATimeout(): void
    {
        $seen = [];
        $handler = static function (RequestInterface $request, array $options) use (&$seen) {
            $seen = ['uri' => (string) $request->getUri(), 'auth' => $request->getHeaderLine('Authorization'), 'options' => $options];

            return new \GuzzleHttp\Promise\FulfilledPromise(new Response(200, ['Content-Type' => 'application/json'], '[{"id":1}]'));
        };
        $http = self::http(resolve: static fn () => ['93.184.216.34'], handler: $handler);

        $answer = $http->api(self::credentials('https://shop.example.com/store'), 'GET', 'orders', ['status' => 'processing', 'per_page' => 1]);

        self::assertSame([['id' => 1]], $answer);
        self::assertSame('https://shop.example.com/store/wp-json/wc/v3/orders?status=processing&per_page=1', $seen['uri'], 'Only the app\'s /wp-json/wc/v3 path under the site.');
        self::assertSame('Basic '.base64_encode('ck_1:cs_1'), $seen['auth']);
        self::assertSame(['shop.example.com:443:93.184.216.34'], $seen['options']['curl'][\CURLOPT_RESOLVE], 'Connected to the address that was checked (no DNS rebinding).');
        self::assertSame(SafeShopHttp::TIMEOUT, $seen['options']['timeout']);
        self::assertFalse($seen['options']['allow_redirects']);
    }

    public function testAShopErrorBecomesShopUnreachableWithItsMessageAndStatus(): void
    {
        $http = self::http(resolve: static fn () => ['93.184.216.34'], handler: new MockHandler([new Response(401, [], '{"code":"woocommerce_rest_cannot_view","message":"Sorry, you cannot list resources."}')]));

        try {
            $http->api(self::credentials(), 'GET', 'orders');
            self::fail('A 401 is a failure.');
        } catch (ShopUnreachable $e) {
            self::assertSame(401, $e->httpStatus());
            self::assertSame('Sorry, you cannot list resources.', $e->reason());
            self::assertStringNotContainsString('cs_1', $e->getMessage());
        }
    }

    public function testOnlyEndpointsTheAppBuildsAreCalled(): void
    {
        $http = self::http(resolve: static fn () => ['93.184.216.34'], handler: new MockHandler([]));

        foreach (['../../wp-admin', 'orders?x=1', 'https://evil.test/orders', 'orders/1/../2', ''] as $endpoint) {
            try {
                $http->api(self::credentials(), 'GET', $endpoint);
                self::fail($endpoint.' must be refused.');
            } catch (\InvalidArgumentException) {
                self::addToAssertionCount(1);
            }
        }
    }

    /**
     * @param (\Closure(string): list<string>)|null $resolve
     */
    private static function http(string $env = 'prod', ?\Closure $resolve = null, ?callable $handler = null): SafeShopHttp
    {
        return new SafeShopHttp($env, $resolve ?? static fn () => [], null === $handler ? null : $handler(...));
    }

    private static function credentials(string $siteUrl = 'https://shop.example.com'): ShopCredentials
    {
        return new ShopCredentials($siteUrl, 'ck_1', 'cs_1');
    }
}
