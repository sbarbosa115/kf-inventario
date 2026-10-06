<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Settings\Domain\Model\AppSetting;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The legacy URL during the cutover (docs/pdr/prd-shops-settings.md, Decisions 8): while the switch is on it works
 * as before (warehouse by `warehouse.urls`, the env secret), a shop that already has a connection is imported through
 * it, what cannot be placed is kept in the inbox (kind `legacy`), and every hit is counted; once off, 410 and the
 * counter. WebhookApiTest keeps the legacy behaviour itself.
 */
final class LegacyWebhookApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    private const URL = '/admin/order/1H39j0jpQPsWL958v9R4';

    public function testOnItPlacesAsBeforeAndCountsTheHit(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);

        $answer = $this->postLegacy('https://usa.test', self::shopOrder(5501));

        $this->assertStatus(200);
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']);
        self::assertSame($warehouse->getId(), $order?->getWarehouse()?->getId(), 'The warehouse whose urls hold the source.');
        self::assertNull($this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $order]), 'No connection: no link.');
        self::assertSame('1', $this->setting('webhooks.legacy_hits'), 'A shop still posting to the old URL shows in the counter.');
    }

    public function testOnAShopThatHasAConnectionIsImportedThroughIt(): void
    {
        $byUrls = $this->aWarehouse('Usa', ['https://kfvintage.example.com/']);
        $colombia = $this->aWarehouse('Colombia');
        $this->aProduct('KF-01', $colombia);
        $this->aProduct('KF-02', $colombia);
        $connection = $this->aConnection($colombia, ['email_printer' => false]);

        $this->postLegacy('https://kfvintage.example.com/', self::shopOrder(5502));

        $this->assertStatus(200);
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5502']);
        self::assertSame($colombia->getId(), $order?->getWarehouse()?->getId(), 'The connection\'s warehouse wins over warehouse.urls ('.$byUrls->getName().').');
        $link = $this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $order]);
        self::assertSame($connection['id'], $link?->connection()->id(), 'Linked: the order names its shop.');
        self::assertEmailCount(0, message: 'The connection\'s printer switch decides.');
        self::assertNotNull($this->connection($connection['id'])->lastImportAt());
    }

    public function testOnWhatCannotBePlacedIsKeptInTheInbox(): void
    {
        $this->aWarehouse('Usa', ['https://usa.test']);

        $this->postLegacy('https://usa.test', self::shopOrder(5503, [['KF-99', 1]]));
        $this->assertStatus(200);
        $this->postLegacy('https://unknown.test', self::shopOrder(5504));
        $this->assertStatus(200);

        $rows = $this->deliveries();
        self::assertSame([[ShopDelivery::KIND_LEGACY, '5503', ShopDelivery::REASON_UNKNOWN_PRODUCT], [ShopDelivery::KIND_LEGACY, '5504', ShopDelivery::REASON_NO_WAREHOUSE]], array_map(static fn (ShopDelivery $d) => [$d->kind(), $d->remoteOrderId(), $d->reasonCode()], $rows));
        self::assertNotNull($rows[0]->payload(), 'With the body, to place it later.');
    }

    public function testOffItAnswers410AndCountsTheHit(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $this->signInAs(['ROLE_ADMIN']);
        $this->sendJson('PUT', '/api/v1/settings/webhooks', ['legacy_enabled' => false]);
        $this->assertStatus(200);

        $answer = $this->postLegacy('https://usa.test', self::shopOrder(5505));
        $this->postLegacy('https://usa.test', self::shopOrder(5506));

        $this->assertStatus(410);
        self::assertSame(['status' => false, 'error' => 'webhook_moved'], $answer);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]));
        self::assertSame([], $this->deliveries(), 'Nothing kept: the shop sees the 410 in its delivery log.');
        $settings = $this->getJson('/api/v1/settings/webhooks');
        self::assertFalse($settings['legacy_enabled']);
        self::assertSame(2, $settings['legacy_hits_since'], 'Counted since it was turned off.');
        self::assertNotNull($settings['legacy_last_hit_at']);
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
}
