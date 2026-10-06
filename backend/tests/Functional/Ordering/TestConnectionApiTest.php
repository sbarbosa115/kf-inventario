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
        self::assertFalse($blank['rest']['ok'], 'Blank fields fall back to the saved keys, which this shop does not know.');
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
