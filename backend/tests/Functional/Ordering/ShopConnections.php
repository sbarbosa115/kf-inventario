<?php

namespace App\Tests\Functional\Ordering;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Tests\Support\ApiTestCase;

/**
 * Shop connections for a test, made through the API as an admin (the answer that creates one is the only one that
 * carries its webhook secret), and deliveries to their webhook, signed as WooCommerce signs them:
 * base64(HMAC-SHA256(raw body, secret)).
 *
 * @phpstan-require-extends ApiTestCase
 */
trait ShopConnections
{
    /**
     * Creates a connection (signed in as an admin) and answers the create answer: id, webhook_url, webhook_secret…
     *
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    protected function aConnection(Warehouse $warehouse, array $overrides = []): array
    {
        $this->signInAs(['ROLE_ADMIN'], 'shop-admin-'.bin2hex(random_bytes(3)));
        $created = $this->sendJson('POST', '/api/v1/shops', $overrides + self::connectionPayload($warehouse));
        $this->assertStatus(201, 'Creating the connection.');

        return $created;
    }

    /**
     * @return array<string, mixed>
     */
    protected static function connectionPayload(Warehouse $warehouse, string $name = 'Kfvintage', string $siteUrl = 'https://kfvintage.example.com'): array
    {
        return [
            'name' => $name,
            'site_url' => $siteUrl,
            'consumer_key' => 'ck_live_key',
            'consumer_secret' => 'cs_live_secret',
            'warehouse_id' => $warehouse->getId(),
            'email_printer' => true,
            'active' => true,
            'capabilities' => ['order_status' => true, 'order_note' => false],
        ];
    }

    /**
     * @param array<string, mixed> $connection the create answer
     */
    protected static function tokenOf(array $connection): string
    {
        return substr((string) $connection['webhook_url'], (int) strrpos((string) $connection['webhook_url'], '/') + 1);
    }

    /**
     * Posts a body to the connection's webhook, signed with $secret (null: no signature header).
     *
     * @param array<string, mixed>|string $payload
     *
     * @return array<mixed>
     */
    protected function deliver(string $token, array|string $payload, ?string $secret): array
    {
        $body = \is_string($payload) ? $payload : json_encode($payload, \JSON_THROW_ON_ERROR);
        $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => 'https://kfvintage.example.com/', 'HTTP_X-WC-Webhook-Topic' => 'order.created'];
        if (null !== $secret) {
            $server['HTTP_X-WC-Webhook-Signature'] = base64_encode(hash_hmac('sha256', $body, $secret, true));
        }
        $this->client->request('POST', ShopConnection::WEBHOOK_PATH.$token, server: $server, content: $body);

        return $this->body();
    }

    /**
     * A WooCommerce order as the webhook posts it.
     *
     * @param list<array{string, int}> $lines sku, quantity
     *
     * @return array<string, mixed>
     */
    protected static function shopOrder(int $id = 5501, array $lines = [['KF-01', 2], ['KF-02', 1]], string $customerNote = ''): array
    {
        return [
            'id' => $id,
            'status' => 'processing',
            'customer_note' => $customerNote,
            'billing' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'email' => 'ana@example.com', 'phone' => '555-0100', 'address_1' => '1 Billing St', 'postcode' => '33101', 'city' => 'Miami', 'state' => 'FL', 'country' => 'US'],
            'shipping' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'address_1' => '2 Shipping Ave', 'postcode' => '10001', 'city' => 'New York', 'state' => 'NY', 'country' => 'US'],
            'line_items' => array_map(static fn (array $line) => ['sku' => $line[0], 'quantity' => $line[1]], $lines),
        ];
    }

    /**
     * @return list<ShopDelivery>
     */
    protected function deliveries(): array
    {
        $this->em()->clear();

        return $this->em()->getRepository(ShopDelivery::class)->findBy([], ['id' => 'ASC']);
    }

    protected function connection(int $id): ShopConnection
    {
        $this->em()->clear();

        return $this->em()->find(ShopConnection::class, $id) ?? throw new \LogicException('No connection '.$id);
    }
}
