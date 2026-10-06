<?php

namespace App\Ordering\Infrastructure\WooCommerce;

use App\Ordering\Application\Port\RemoteNote;
use App\Ordering\Application\Port\ShopCredentials;
use App\Ordering\Application\Port\ShopGateway;
use App\Ordering\Application\Port\StoreInfo;
use App\Ordering\Domain\Error\ShopUnreachable;
use App\Shared\Domain\Clock;
use Psr\Log\LoggerInterface;

/**
 * A shop's WooCommerce REST API (wc/v3), every call through SafeShopHttp (https, no internal address, no redirect,
 * 15 s). Failures are logged with the shop's address and message (never the keys) and thrown as ShopUnreachable.
 */
final class RestShopGateway implements ShopGateway
{
    public const PER_PAGE = 100;
    public const MAX_PAGES = 20;
    /** Without a pull cursor, the orders created in the last DAYS days (the old sync's window). */
    public const DAYS = 30;

    public function __construct(
        private readonly SafeShopHttp $http,
        private readonly Clock $clock,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * The keys must read orders (what the pull needs); the WooCommerce version (system_status) and the site's name
     * (/wp-json/) are best-effort: an admin-only report or a hidden index does not fail the test.
     */
    public function storeInfo(ShopCredentials $shop): StoreInfo
    {
        $this->read($shop, 'orders', ['per_page' => 1]);

        $version = null;
        try {
            $status = $this->http->api($shop, 'GET', 'system_status');
            $version = \is_array($status) && \is_array($status['environment'] ?? null) && \is_scalar($status['environment']['version'] ?? null) ? (string) $status['environment']['version'] : null;
        } catch (ShopUnreachable) {
        }
        $name = null;
        try {
            $index = $this->http->siteIndex($shop->siteUrl);
            $name = \is_string($index['name'] ?? null) ? html_entity_decode($index['name'], \ENT_QUOTES) : null;
        } catch (ShopUnreachable) {
        }

        return new StoreInfo($name, $version);
    }

    public function ordersModifiedSince(ShopCredentials $shop, ?\DateTimeImmutable $since, string $status = 'processing'): array
    {
        $query = ['status' => $status, 'orderby' => 'modified', 'order' => 'asc', 'per_page' => self::PER_PAGE, 'dates_are_gmt' => 'true'];
        if (null === $since) {
            $query['after'] = $this->clock->now()->setTimezone(new \DateTimeZone('UTC'))->modify(\sprintf('-%d days', self::DAYS))->format('Y-m-d\TH:i:s');
        } else {
            $query['modified_after'] = $since->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s');
        }

        $orders = [];
        for ($page = 1; $page <= self::MAX_PAGES; ++$page) {
            $batch = $this->list($shop, 'orders', $query + ['page' => $page]);
            array_push($orders, ...$batch);
            if (\count($batch) < self::PER_PAGE) {
                return $orders;
            }
        }
        $this->logger->warning(\sprintf('WooCommerce shop [%s] has more than %d orders to read: the rest come with the next pull.', $shop->siteUrl, self::PER_PAGE * self::MAX_PAGES));

        return $orders;
    }

    public function orderNotes(ShopCredentials $shop, string $remoteOrderId): array
    {
        $notes = [];
        foreach ($this->list($shop, 'orders/'.self::orderId($remoteOrderId).'/notes', []) as $note) {
            if (!\is_scalar($note['id'] ?? null)) {
                continue;
            }
            $created = \is_string($note['date_created_gmt'] ?? null) ? new \DateTimeImmutable($note['date_created_gmt'], new \DateTimeZone('UTC')) : null;
            $notes[] = new RemoteNote((string) $note['id'], \is_string($note['note'] ?? null) ? $note['note'] : '', true === ($note['customer_note'] ?? false), $created);
        }

        return $notes;
    }

    public function updateOrderStatus(ShopCredentials $shop, string $remoteOrderId, string $status): void
    {
        $this->write($shop, 'PUT', 'orders/'.self::orderId($remoteOrderId), ['status' => $status]);
    }

    public function addOrderNote(ShopCredentials $shop, string $remoteOrderId, string $note): string
    {
        $answer = $this->write($shop, 'POST', 'orders/'.self::orderId($remoteOrderId).'/notes', ['note' => $note, 'customer_note' => false]);
        if (!\is_array($answer) || !\is_scalar($answer['id'] ?? null)) {
            throw new ShopUnreachable('The shop did not answer the new note\'s id.');
        }

        return (string) $answer['id'];
    }

    /**
     * @param array<string, scalar> $query
     *
     * @return list<array<mixed>>
     */
    private function list(ShopCredentials $shop, string $endpoint, array $query): array
    {
        $answer = $this->read($shop, $endpoint, $query);
        if (!\is_array($answer) || !array_is_list($answer)) {
            $this->logger->error(\sprintf('WooCommerce shop [%s] did not answer a list for %s.', $shop->siteUrl, $endpoint));

            throw new ShopUnreachable('The shop did not answer a list: is this WooCommerce\'s REST API?');
        }

        return array_values(array_filter($answer, \is_array(...)));
    }

    /**
     * @param array<string, scalar> $query
     */
    private function read(ShopCredentials $shop, string $endpoint, array $query): mixed
    {
        try {
            return $this->http->api($shop, 'GET', $endpoint, $query);
        } catch (ShopUnreachable $e) {
            $this->logger->error(\sprintf('WooCommerce shop [%s] could not be read (%s): %s', $shop->siteUrl, $endpoint, $e->reason()));

            throw $e;
        }
    }

    /**
     * @param array<string, mixed> $body
     */
    private function write(ShopCredentials $shop, string $method, string $endpoint, array $body): mixed
    {
        try {
            return $this->http->api($shop, $method, $endpoint, [], $body);
        } catch (ShopUnreachable $e) {
            $this->logger->error(\sprintf('WooCommerce shop [%s] refused %s %s: %s', $shop->siteUrl, $method, $endpoint, $e->reason()));

            throw $e;
        }
    }

    private static function orderId(string $remoteOrderId): string
    {
        if (1 !== preg_match('/^[0-9]{1,20}$/', $remoteOrderId)) {
            throw new ShopUnreachable(\sprintf('"%s" is not a WooCommerce order id.', $remoteOrderId));
        }

        return $remoteOrderId;
    }
}
