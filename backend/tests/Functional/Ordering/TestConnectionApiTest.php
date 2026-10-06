<?php

namespace App\Tests\Functional\Ordering;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * "Test connection" (docs/pdr/prd-shops-settings.md, POST /shops/{id}/test): the shop's REST API answers with the
 * keys typed in the form (testing before saving) or the saved ones; the answer says what happened and never fails
 * itself. The shops are FakeShopGateway's (config/services_test.yaml): no real shop is called.
 */
final class TestConnectionApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    protected function setUp(): void
    {
        parent::setUp();
        FakeShopGateway::reset();
    }

    public function testWithTheSavedKeysTheShopIsNamed(): void
    {
        FakeShopGateway::shop('https://kfvintage.example.com', 'ck_live_key', 'cs_live_secret', name: 'KF Vintage', version: '9.1.0');
        $connection = $this->aConnection($this->aWarehouse());

        $result = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test');

        $this->assertStatus(200);
        self::assertSame(['ok' => true, 'store_name' => 'KF Vintage', 'wc_version' => '9.1.0', 'can_write' => null, 'error' => null], $result['rest'], 'can_write is unknown until a write succeeded.');
        self::assertSame($connection['webhook_url'], $result['webhook_url']);
        self::assertTrue($result['webhook_secret_set']);
    }

    public function testWrongKeysSayWhyWithoutAnErrorStatus(): void
    {
        FakeShopGateway::shop('https://kfvintage.example.com', 'ck_other', 'cs_other');
        $connection = $this->aConnection($this->aWarehouse());

        $result = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test');

        $this->assertStatus(200, 'The result says it: the request itself worked.');
        self::assertFalse($result['rest']['ok']);
        self::assertSame('Consumer key is invalid.', $result['rest']['error']);
        self::assertNull($result['rest']['store_name']);
        self::assertStringNotContainsString('cs_live_secret', (string) $this->client->getResponse()->getContent());
    }

    public function testTheKeysAndUrlTypedInTheFormAreTestedBeforeSaving(): void
    {
        FakeShopGateway::shop('https://new.example.com', 'ck_typed', 'cs_typed', name: 'New shop');
        $connection = $this->aConnection($this->aWarehouse());

        $result = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test', ['site_url' => 'https://NEW.example.com/', 'consumer_key' => 'ck_typed', 'consumer_secret' => 'cs_typed']);

        $this->assertStatus(200);
        self::assertTrue($result['rest']['ok']);
        self::assertSame('New shop', $result['rest']['store_name']);

        $blank = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test', ['site_url' => 'https://new.example.com', 'consumer_key' => '', 'consumer_secret' => '']);
        self::assertFalse($blank['rest']['ok'], 'Blank fields do not send the saved keys to another site.');
    }

    /**
     * Security audit 2026-10-06 (finding 1): the saved keys are never sent to a site URL typed in the form. Before,
     * "Test" with another URL and blank keys sent the saved consumer key and secret to that host (HTTP Basic), so an
     * admin session could read keys the API never shows.
     */
    public function testTheSavedKeysAreNeverSentToAnotherSite(): void
    {
        FakeShopGateway::shop('https://collector.example.net', 'ck_live_key', 'cs_live_secret', name: 'Collector');
        FakeShopGateway::shop('https://kfvintage.example.com/shop', 'ck_live_key', 'cs_live_secret', name: 'KF Vintage');
        $connection = $this->aConnection($this->aWarehouse());

        foreach ([['', ''], ['ck_typed', ''], ['', null]] as [$key, $secret]) {
            $result = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test', ['site_url' => 'https://collector.example.net', 'consumer_key' => $key, 'consumer_secret' => $secret]);

            $this->assertStatus(200);
            self::assertFalse($result['rest']['ok'], 'The saved keys stay with the saved site (the collector would have taken them).');
            self::assertNull($result['rest']['store_name']);
            self::assertStringContainsString('consumer key and secret', (string) $result['rest']['error']);
        }

        $samePlace = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test', ['site_url' => 'https://KFVINTAGE.example.com/shop', 'consumer_key' => '', 'consumer_secret' => '']);
        self::assertTrue($samePlace['rest']['ok'], 'Another path on the same site keeps using the saved keys.');
    }

    public function testAPrivateHostOrAShopThatIsDownIsReportedNotThrown(): void
    {
        FakeShopGateway::failing('https://kfvintage.example.com', 'cURL error 28: Operation timed out after 15000 milliseconds');
        $connection = $this->aConnection($this->aWarehouse());

        $down = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test');
        $this->assertStatus(200);
        self::assertFalse($down['rest']['ok']);
        self::assertStringContainsString('timed out', (string) $down['rest']['error']);

        $private = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/test', ['site_url' => 'https://192.168.1.20']);
        $this->assertStatus(200);
        self::assertFalse($private['rest']['ok']);
        self::assertStringContainsString('private', (string) $private['rest']['error']);
    }

    public function testAnUnknownConnectionIsNotFound(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $this->sendJson('POST', '/api/v1/shops/999999/test');

        $this->assertStatus(404);
        self::assertSame('shop_not_found', $this->body()['error']);
    }
}
