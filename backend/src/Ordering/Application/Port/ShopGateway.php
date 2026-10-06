<?php

namespace App\Ordering\Application\Port;

use App\Ordering\Domain\Error\ShopUnreachable;

/**
 * A WooCommerce shop's REST API (/wp-json/wc/v3), the one way the app talks to a shop: "Test connection", the
 * catch-up pull, the shop notes and the write-back (docs/pdr/prd-shops-settings.md, "Shop connections"). The real
 * adapter (item 5a: RestShopGateway over SafeShopHttp — https only, no private hosts, no redirects, 15 s) is the
 * only one that leaves the server; tests bind FakeShopGateway (config/services_test.yaml).
 *
 * Every method throws ShopUnreachable when the shop cannot be used; none returns a partial answer.
 */
interface ShopGateway
{
    /**
     * @throws ShopUnreachable
     */
    public function storeInfo(ShopCredentials $shop): StoreInfo;

    /**
     * The shop's orders in `status` modified after `since` (the connection's pull cursor; null: the last 30 days),
     * each as the REST API returns it — the same JSON the webhook posts.
     *
     * @return list<array<string, mixed>>
     *
     * @throws ShopUnreachable
     */
    public function ordersModifiedSince(ShopCredentials $shop, ?\DateTimeImmutable $since, string $status = 'processing'): array;

    /**
     * @return list<RemoteNote>
     *
     * @throws ShopUnreachable
     */
    public function orderNotes(ShopCredentials $shop, string $remoteOrderId): array;

    /**
     * @throws ShopUnreachable
     */
    public function updateOrderStatus(ShopCredentials $shop, string $remoteOrderId, string $status): void;

    /**
     * @return string the new note's id on the shop
     *
     * @throws ShopUnreachable
     */
    public function addOrderNote(ShopCredentials $shop, string $remoteOrderId, string $note): string;
}
