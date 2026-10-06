<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Application\Port\RemoteNote;
use App\Ordering\Application\Port\ShopCredentials;
use App\Ordering\Application\Port\ShopGateway;
use App\Ordering\Application\Port\StoreInfo;
use App\Ordering\Domain\Error\ShopUnreachable;

/**
 * The WooCommerce shops of a test (config/services_test.yaml): tests never call a real shop. A shop is named by its
 * site URL; its state is static because the test client boots a new kernel, and a new instance of this service, for
 * each request. reset() in setUp.
 */
final class FakeShopGateway implements ShopGateway
{
    /** @var array<string, array{name: string, version: string, key: string, secret: string, orders: list<array<string, mixed>>, notes: array<string, list<RemoteNote>>}> */
    private static array $shops = [];

    /** @var array<string, array{reason: string, status: int|null}> */
    private static array $failing = [];

    /** @var list<array{shop: string, call: string, order: string, value: string}> what the app wrote to the shops */
    private static array $writes = [];

    public static function reset(): void
    {
        self::$shops = [];
        self::$failing = [];
        self::$writes = [];
    }

    /**
     * A shop that answers to these keys, with these orders waiting (the REST API's JSON, the webhook's shape).
     *
     * @param list<array<string, mixed>> $orders
     */
    public static function shop(string $siteUrl, string $key = 'ck_test', string $secret = 'cs_test', array $orders = [], string $name = 'Fake shop', string $version = '8.9.0'): void
    {
        self::$shops[$siteUrl] = ['name' => $name, 'version' => $version, 'key' => $key, 'secret' => $secret, 'orders' => $orders, 'notes' => []];
    }

    /**
     * @param list<RemoteNote> $notes
     */
    public static function notes(string $siteUrl, string $remoteOrderId, array $notes): void
    {
        self::$shops[$siteUrl]['notes'][$remoteOrderId] = $notes;
    }

    /** Every call to this shop fails (down: no status; read-only keys: 401). */
    public static function failing(string $siteUrl, string $reason = 'Connection refused', ?int $status = null): void
    {
        self::$failing[$siteUrl] = ['reason' => $reason, 'status' => $status];
    }

    /**
     * @return list<array{shop: string, call: string, order: string, value: string}>
     */
    public static function writes(): array
    {
        return self::$writes;
    }

    public function storeInfo(ShopCredentials $shop): StoreInfo
    {
        $known = $this->answer($shop);

        return new StoreInfo($known['name'], $known['version']);
    }

    public function ordersModifiedSince(ShopCredentials $shop, ?\DateTimeImmutable $since, string $status = 'processing'): array
    {
        return array_values(array_filter(
            $this->answer($shop)['orders'],
            static fn (array $order): bool => ($order['status'] ?? 'processing') === $status
                && (null === $since || !isset($order['date_modified_gmt']) || new \DateTimeImmutable((string) $order['date_modified_gmt'], new \DateTimeZone('UTC')) > $since),
        ));
    }

    public function orderNotes(ShopCredentials $shop, string $remoteOrderId): array
    {
        return $this->answer($shop)['notes'][$remoteOrderId] ?? [];
    }

    public function updateOrderStatus(ShopCredentials $shop, string $remoteOrderId, string $status): void
    {
        $this->answer($shop);
        self::$writes[] = ['shop' => $shop->siteUrl, 'call' => 'status', 'order' => $remoteOrderId, 'value' => $status];
    }

    public function addOrderNote(ShopCredentials $shop, string $remoteOrderId, string $note): string
    {
        $this->answer($shop);
        self::$writes[] = ['shop' => $shop->siteUrl, 'call' => 'note', 'order' => $remoteOrderId, 'value' => $note];

        return (string) (1000 + \count(self::$writes));
    }

    /**
     * @return array{name: string, version: string, key: string, secret: string, orders: list<array<string, mixed>>, notes: array<string, list<RemoteNote>>}
     */
    private function answer(ShopCredentials $shop): array
    {
        if (isset(self::$failing[$shop->siteUrl])) {
            throw new ShopUnreachable(self::$failing[$shop->siteUrl]['reason'], self::$failing[$shop->siteUrl]['status']);
        }
        $known = self::$shops[$shop->siteUrl] ?? throw new ShopUnreachable('No WooCommerce shop answers at '.$shop->siteUrl);
        if ($known['key'] !== $shop->consumerKey || $known['secret'] !== $shop->consumerSecret) {
            throw new ShopUnreachable('Consumer key is invalid.', 401);
        }

        return $known;
    }
}
