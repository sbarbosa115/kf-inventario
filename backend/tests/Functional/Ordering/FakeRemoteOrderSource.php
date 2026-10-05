<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Application\Port\RemoteOrderSource;
use App\Ordering\Domain\Error\OrderSyncFailed;

/**
 * The WooCommerce shops of a test (config/services_test.yaml): tests never call a real shop. Its state is static
 * because the test client boots a new kernel, and a new instance of this service, for each request.
 */
final class FakeRemoteOrderSource implements RemoteOrderSource
{
    /** @var array<string, list<array<mixed>>> the orders of each shop the app holds keys for */
    private static array $shops = [];

    /** @var list<string> */
    private static array $failing = [];

    /** @var list<string> */
    private static array $asked = [];

    public static function reset(): void
    {
        self::$shops = [];
        self::$failing = [];
        self::$asked = [];
    }

    /**
     * The app holds this shop's keys, and the shop has these orders waiting.
     *
     * @param list<array<mixed>> $orders
     */
    public static function shopWith(string $shop, array $orders): void
    {
        self::$shops[$shop] = $orders;
    }

    /**
     * The app holds this shop's keys, but the shop cannot be read.
     */
    public static function failingShop(string $shop): void
    {
        self::$shops[$shop] = [];
        self::$failing[] = $shop;
    }

    /**
     * @return list<string> the shops whose orders were asked for
     */
    public static function asked(): array
    {
        return self::$asked;
    }

    public function shops(): array
    {
        return array_keys(self::$shops);
    }

    public function ordersOf(string $shop): array
    {
        self::$asked[] = $shop;
        if (\in_array($shop, self::$failing, true) || !isset(self::$shops[$shop])) {
            throw new OrderSyncFailed($shop);
        }

        return self::$shops[$shop];
    }
}
