<?php

namespace App\Tests\Functional\Settings;

use App\Settings\Domain\Model\AppSetting;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The settings endpoints item 0 of shops-settings builds for the Settings shell (docs/pdr/prd-shops-settings.md,
 * Decisions: coordinator note 0.4): the analytics IDs every signed-in page reads, where email leaves from, and the
 * legacy webhook switch of the General tab. Item 3 (settings-api) builds the rest of /settings.
 */
final class SettingsShellApiTest extends ApiTestCase
{
    use SignsIn;

    public function testEverySignedInPageReadsTheAnalyticsIdsNullWhenUnset(): void
    {
        $this->signInAs(['ROLE_USER']);

        self::assertSame(['ga4_measurement_id' => null, 'clarity_project_id' => null], $this->getJson('/api/v1/settings/public'));

        $this->save(new AppSetting('analytics.ga4_id', 'G-ABC1234', false, new \DateTimeImmutable()));
        self::assertSame('G-ABC1234', $this->getJson('/api/v1/settings/public')['ga4_measurement_id']);
    }

    public function testTheEmailSettingsSayWhereEachValueComesFromAndNeverTheSecret(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $email = $this->getJson('/api/v1/settings/email');

        $this->assertStatus(200);
        self::assertSame(['dsn' => 'env', 'from' => 'env', 'printer' => 'env', 'cc' => 'env'], $email['source'], 'With nothing in Settings, the env applies (.env.test).');
        self::assertFalse($email['has_password']);
        self::assertSame('null', $email['env_host'] ?? null, 'The env server (null://null in tests) is named for "when empty, MAILER_DSN is used".');
        self::assertArrayNotHasKey('password', $email);
        self::assertArrayNotHasKey('dsn', $email);
    }

    public function testTheLegacyWebhookSwitchIsOnUntilTurnedOffWhichRestartsItsCounter(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->save(
            new AppSetting('webhooks.legacy_hits', '7', false, new \DateTimeImmutable()),
        );

        self::assertSame(['legacy_enabled' => true, 'legacy_hits_since' => 7, 'legacy_last_hit_at' => null], $this->getJson('/api/v1/settings/webhooks'));

        $off = $this->sendJson('PUT', '/api/v1/settings/webhooks', ['legacy_enabled' => false]);

        $this->assertStatus(200);
        self::assertSame(['legacy_enabled' => false, 'legacy_hits_since' => 0, 'legacy_last_hit_at' => null], $off);
        $this->sendJson('PUT', '/api/v1/settings/webhooks', ['legacy_enabled' => 'nope']);
        $this->assertStatus(422);
    }

    public function testOnlyAnAdminReadsOrChangesThem(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->getJson('/api/v1/settings/email');
        $this->assertStatus(403);
        $this->sendJson('PUT', '/api/v1/settings/webhooks', ['legacy_enabled' => false]);
        $this->assertStatus(403);
    }
}
