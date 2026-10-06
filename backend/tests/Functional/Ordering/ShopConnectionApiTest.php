<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\ShopConnection;
use App\Settings\Application\Port\SecretBox;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * Shop connections (docs/pdr/prd-shops-settings.md, "Shop connections"): an admin creates one per WooCommerce shop,
 * gets its webhook URL and signing secret to paste in the shop, edits it without retyping the keys, and cannot delete
 * one that orders came from.
 */
final class ShopConnectionApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    public function testCreatingAConnectionAnswersItsWebhookSecretOnceAndNeverTheKeys(): void
    {
        $warehouse = $this->aWarehouse('Usa');

        $created = $this->aConnection($warehouse, ['site_url' => 'HTTPS://Shop.Example.COM/store/']);

        self::assertSame('Kfvintage', $created['name']);
        self::assertSame('https://shop.example.com/store', $created['site_url'], 'Stored normalised: lower-case scheme and host, no trailing slash.');
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', (string) $created['webhook_secret'], '32 random bytes, hex: shown once, to paste in WooCommerce.');
        self::assertMatchesRegularExpression('#^http://localhost/webhooks/shops/[0-9a-f]{64}$#', (string) $created['webhook_url'], 'The connection\'s own URL, an unguessable token.');
        self::assertTrue($created['has_keys']);
        self::assertSame(['id' => $warehouse->getId(), 'name' => 'Usa'], $created['warehouse']);
        self::assertSame(['order_status' => true, 'order_note' => false], $created['capabilities']);
        self::assertTrue($created['email_printer']);
        self::assertTrue($created['active']);
        self::assertSame(0, $created['health']['failed_deliveries']);
        self::assertNull($created['health']['last_webhook_at']);
        $raw = (string) $this->client->getResponse()->getContent();
        self::assertStringNotContainsString('ck_live_key', $raw, 'The consumer key is never echoed.');
        self::assertStringNotContainsString('cs_live_secret', $raw, 'The consumer secret is never echoed.');

        $shown = $this->getJson('/api/v1/shops/'.$created['id']);
        $this->assertStatus(200);
        self::assertNull($shown['webhook_secret'], 'Only the create answer carries the secret.');
        self::assertSame($created['webhook_url'], $shown['webhook_url']);
        $list = $this->getJson('/api/v1/shops');
        self::assertSame([$created['id']], array_column($list, 'id'));
        self::assertNull($list[0]['webhook_secret']);

        $stored = $this->connection($created['id']);
        self::assertStringStartsWith('v1:', $stored->sealedConsumerKey(), 'Sealed at rest.');
        self::assertStringStartsWith('v1:', $stored->sealedConsumerSecret());
        self::assertStringStartsWith('v1:', $stored->sealedWebhookSecret());
        self::assertSame('cs_live_secret', $this->box()->open($stored->sealedConsumerSecret()));
        self::assertSame($created['webhook_secret'], $this->box()->open($stored->sealedWebhookSecret()));
    }

    public function testTheSigningSecretCanBeReadAgainAndRotated(): void
    {
        $created = $this->aConnection($this->aWarehouse());

        $read = $this->getJson('/api/v1/shops/'.$created['id'].'/webhook-secret');
        $this->assertStatus(200);
        self::assertSame(['webhook_secret' => $created['webhook_secret'], 'webhook_url' => $created['webhook_url']], $read, 'The shop\'s paste value: admins may read it again.');

        $rotated = $this->sendJson('POST', '/api/v1/shops/'.$created['id'].'/webhook-secret');
        $this->assertStatus(200);
        self::assertNotSame($created['webhook_secret'], $rotated['webhook_secret']);
        self::assertSame($created['webhook_url'], $rotated['webhook_url'], 'Rotating changes the secret, not the URL.');
        self::assertSame($rotated, $this->getJson('/api/v1/shops/'.$created['id'].'/webhook-secret'));
    }

    public function testATakenSiteUrlOrNameIsRefused(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aConnection($warehouse);

        $this->sendJson('POST', '/api/v1/shops', ['name' => 'Another'] + self::connectionPayload($warehouse, siteUrl: 'https://KFVINTAGE.example.com/'));
        $this->assertStatus(409);
        self::assertSame('shop_url_taken', $this->body()['error'], 'The same site, spelled another way, is the same shop.');

        $this->sendJson('POST', '/api/v1/shops', self::connectionPayload($warehouse, siteUrl: 'https://other.example.com'));
        $this->assertStatus(409);
        self::assertSame('shop_name_taken', $this->body()['error']);
    }

    public function testAPrivateHostOrPlainHttpIsRefused(): void
    {
        $warehouse = $this->aWarehouse();
        $this->signInAs(['ROLE_ADMIN']);

        foreach (['https://127.0.0.1', 'https://localhost/store', 'https://10.1.2.3', 'https://192.168.0.10', 'https://169.254.169.254', 'http://shop.example.com'] as $url) {
            $this->sendJson('POST', '/api/v1/shops', self::connectionPayload($warehouse, siteUrl: $url));

            $this->assertStatus(422, $url.' must be refused (SSRF; http only in dev).');
            self::assertSame('shop_url_invalid', $this->body()['error'], $url);
        }
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(ShopConnection::class)->count([]));
    }

    public function testAnUnknownWarehouseIsNotFound(): void
    {
        $warehouse = $this->aWarehouse();
        $this->signInAs(['ROLE_ADMIN']);

        $this->sendJson('POST', '/api/v1/shops', ['warehouse_id' => (int) $warehouse->getId() + 1000] + self::connectionPayload($warehouse));

        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $this->body()['error']);
    }

    public function testEditingWithBlankKeysKeepsTheSavedOnes(): void
    {
        $usa = $this->aWarehouse('Usa');
        $colombia = $this->aWarehouse('Colombia');
        $created = $this->aConnection($usa);

        $edited = $this->sendJson('PUT', '/api/v1/shops/'.$created['id'], [
            'name' => 'Kfvintage US', 'site_url' => 'https://kfvintage.example.com', 'consumer_key' => '', 'consumer_secret' => null,
            'warehouse_id' => $colombia->getId(), 'email_printer' => false, 'active' => false, 'capabilities' => ['order_note' => true],
        ]);

        $this->assertStatus(200);
        self::assertSame('Kfvintage US', $edited['name']);
        self::assertSame(['id' => $colombia->getId(), 'name' => 'Colombia'], $edited['warehouse']);
        self::assertFalse($edited['email_printer']);
        self::assertFalse($edited['active']);
        self::assertSame(['order_status' => false, 'order_note' => true], $edited['capabilities']);
        self::assertTrue($edited['has_keys']);
        self::assertNull($edited['webhook_secret']);
        $stored = $this->connection($created['id']);
        self::assertSame('ck_live_key', $this->box()->open($stored->sealedConsumerKey()), 'Blank keeps the saved key.');
        self::assertSame('cs_live_secret', $this->box()->open($stored->sealedConsumerSecret()));

        $this->sendJson('PUT', '/api/v1/shops/'.$created['id'], ['consumer_key' => 'ck_new', 'consumer_secret' => ''] + self::connectionPayload($usa));
        $this->assertStatus(200);
        $stored = $this->connection($created['id']);
        self::assertSame('ck_new', $this->box()->open($stored->sealedConsumerKey()), 'A typed key replaces the saved one.');
        self::assertSame('cs_live_secret', $this->box()->open($stored->sealedConsumerSecret()), 'The blank one is kept.');

        $this->sendJson('PUT', '/api/v1/shops/'.$created['id'], self::connectionPayload($usa, siteUrl: 'https://10.0.0.1'));
        $this->assertStatus(422);
        self::assertSame('shop_url_invalid', $this->body()['error']);
        $this->sendJson('PUT', '/api/v1/shops/999999', self::connectionPayload($usa));
        $this->assertStatus(404);
        self::assertSame('shop_not_found', $this->body()['error']);
    }

    public function testAConnectionOrdersCameFromCannotBeDeleted(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $used = $this->aConnection($warehouse);
        $this->deliver(self::tokenOf($used), self::shopOrder(), (string) $used['webhook_secret']);
        $this->assertStatus(200);
        $unused = $this->aConnection($warehouse, ['name' => 'Unused', 'site_url' => 'https://unused.example.com']);
        $this->deliver(self::tokenOf($unused), self::shopOrder(7001, [['KF-404', 1]]), (string) $unused['webhook_secret']);

        $this->client->request('DELETE', '/api/v1/shops/'.$used['id']);
        $this->assertStatus(409);
        self::assertSame('shop_has_orders', $this->body()['error'], 'Deactivate it instead: its orders keep their shop.');

        $this->client->request('DELETE', '/api/v1/shops/'.$unused['id']);
        $this->assertStatus(204, 'A connection no order came from goes, with its failed deliveries.');
        $this->em()->clear();
        self::assertNull($this->em()->find(ShopConnection::class, $unused['id']));
        self::assertNotNull($this->em()->find(ShopConnection::class, $used['id']));
    }

    public function testOnlyAnAdminManagesConnections(): void
    {
        $created = $this->aConnection($this->aWarehouse());
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_READ_ORDERS', 'ROLE_MANAGE_USERS', 'ROLE_CAN_SYNC_ORDERS'], 'office');

        foreach ([['GET', '/api/v1/shops'], ['GET', '/api/v1/shops/'.$created['id']], ['GET', '/api/v1/shops/'.$created['id'].'/webhook-secret'], ['POST', '/api/v1/shops'], ['DELETE', '/api/v1/shops/'.$created['id']]] as [$method, $path]) {
            $this->sendJson($method, $path);

            $this->assertStatus(403, "{$method} {$path} is ROLE_ADMIN's.");
        }
    }

    private function box(): SecretBox
    {
        return static::getContainer()->get(SecretBox::class);
    }
}
