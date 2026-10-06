<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\Order;
use App\Settings\Domain\Model\AppSetting;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Monolog\Handler\TestHandler;

/**
 * The legacy WooCommerce webhook URL is a tombstone (docs/pdr/prd-shops-settings.md, "Decision (user, 2026-10-06): the
 * legacy webhook is removed"): the shops post to their connection's URL (/webhooks/shops/{token}, ShopWebhookApiTest).
 * The old path stays public and answers 410 {status: false, error: "webhook_moved"} to everything, places nothing,
 * keeps no body, and counts the hit so a shop that was never re-pointed shows in Settings and on Orders.
 */
final class WebhookApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    private const URL = '/admin/order/1H39j0jpQPsWL958v9R4';

    public function testAnOrderPostedToTheOldUrlIsRefusedWith410PlacesNothingAndIsCounted(): void
    {
        // Everything the removed import path matched on: a warehouse whose `urls` hold the source and a connection
        // whose site is the source. Neither is used any more.
        $warehouse = $this->aWarehouse('Usa', ['https://kfvintage.example.com/']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $this->aConnection($warehouse);
        $this->client->disableReboot();
        $logs = $this->logHandler();

        $answer = $this->postLegacy('https://kfvintage.example.com/', self::shopOrder(5501));
        $this->postLegacy('https://kfvintage.example.com/', self::shopOrder(5502));

        $this->assertStatus(410, 'Gone: WooCommerce shows it in the webhook\'s delivery log and, after its retries, disables it.');
        self::assertSame(['status' => false, 'error' => 'webhook_moved'], $answer);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]), 'Nothing is placed, whatever the source.');
        self::assertSame([], $this->deliveries(), 'No body is kept: the old URL fills nothing.');
        self::assertSame('2', $this->setting('webhooks.legacy_hits'), 'Each hit is counted.');
        self::assertNotNull($this->setting('webhooks.legacy_last_hit_at'));
        self::assertEmailCount(0);
        self::assertTrue($logs->hasWarningThatContains('https://kfvintage.example.com/'), 'The source of the hit is logged.');
    }

    public function testASignedDeliveryIsRefusedToo(): void
    {
        $_SERVER['WOO_COMMERCE_WEBHOOK_SECRET'] = $_ENV['WOO_COMMERCE_WEBHOOK_SECRET'] = 's3cret';
        try {
            $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
            $this->aProduct('KF-01', $warehouse);
            $this->aProduct('KF-02', $warehouse);
            $body = json_encode(self::shopOrder(5701), \JSON_THROW_ON_ERROR);

            $this->client->request('POST', self::URL, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => 'https://usa.test', 'HTTP_X-WC-Webhook-Signature' => base64_encode(hash_hmac('sha256', $body, 's3cret', true))], content: $body);

            $this->assertStatus(410, 'No secret reopens the old URL.');
            $this->em()->clear();
            self::assertSame(0, $this->em()->getRepository(Order::class)->count([]));
        } finally {
            unset($_SERVER['WOO_COMMERCE_WEBHOOK_SECRET'], $_ENV['WOO_COMMERCE_WEBHOOK_SECRET']);
        }
    }

    public function testTheOldUrlNeedsNoSignInAndAnswersAGetToo(): void
    {
        $this->client->request('GET', self::URL, server: ['HTTP_X-WC-Webhook-Source' => 'https://unknown.test']);

        $this->assertStatus(410, 'Public (the shops do not sign in), outside the SPA, GET as before.');
        self::assertSame(['status' => false, 'error' => 'webhook_moved'], $this->body());
        self::assertSame('1', $this->setting('webhooks.legacy_hits'));
    }

    public function testSettingsShowTheHitsSinceTheDeploy(): void
    {
        $this->postLegacy('https://usa.test', self::shopOrder(5801));
        $this->signInAs(['ROLE_ADMIN']);

        $webhooks = $this->getJson('/api/v1/settings/webhooks');

        $this->assertStatus(200);
        self::assertSame(['legacy_hits', 'legacy_last_hit_at'], array_keys($webhooks), 'Read-only: no switch any more.');
        self::assertSame(1, $webhooks['legacy_hits']);
        self::assertNotNull($webhooks['legacy_last_hit_at']);
    }

    /**
     * @param array<string, mixed> $payload
     *
     * @return array<mixed>
     */
    private function postLegacy(string $source, array $payload): array
    {
        $this->client->request('POST', self::URL, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => $source], content: json_encode($payload, \JSON_THROW_ON_ERROR));

        return $this->body();
    }

    private function setting(string $key): ?string
    {
        $this->em()->clear();

        return $this->em()->find(AppSetting::class, $key)?->value();
    }

    private function logHandler(): TestHandler
    {
        $logger = static::getContainer()->get('logger');
        $handler = new TestHandler();
        $logger->pushHandler($handler);

        return $handler;
    }
}
