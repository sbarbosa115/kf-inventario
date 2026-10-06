<?php

namespace App\Tests\Functional\Settings;

use App\Audit\Domain\Model\Log;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * Settings › Analytics (docs/pdr/prd-shops-settings.md, "API changes" › Settings and Security): the GA4 Measurement
 * ID and the Clarity Project ID, checked by shape because the loader puts them in a script URL; empty turns a tool off.
 */
final class AnalyticsSettingsApiTest extends ApiTestCase
{
    use SignsIn;

    public function testTheIdsAreSavedAndEveryPageReadsThem(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        self::assertSame(['ga4_measurement_id' => null, 'clarity_project_id' => null], $this->getJson('/api/v1/settings/analytics'), 'Unset: both off.');

        $saved = $this->sendJson('PUT', '/api/v1/settings/analytics', ['ga4_measurement_id' => 'G-AB12CD34', 'clarity_project_id' => 'k3x9q2m7']);

        $this->assertStatus(200);
        self::assertSame(['ga4_measurement_id' => 'G-AB12CD34', 'clarity_project_id' => 'k3x9q2m7'], $saved);
        self::assertSame($saved, $this->getJson('/api/v1/settings/analytics'));
        self::assertSame($saved, $this->getJson('/api/v1/settings/public'), 'The loader of every signed-in page reads the same ids.');
        $this->em()->clear();
        $log = $this->em()->getRepository(Log::class)->findOneBy(['entity' => 'settings'], ['id' => 'DESC']);
        self::assertNotNull($log);
        self::assertStringContainsString('analytics.ga4_id', (string) $log->getDetail());
        self::assertStringNotContainsString('G-AB12CD34', (string) $log->getDetail(), 'Keys, not values.');
    }

    public function testAnEmptyIdTurnsThatToolOff(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->sendJson('PUT', '/api/v1/settings/analytics', ['ga4_measurement_id' => 'G-AB12CD34', 'clarity_project_id' => 'k3x9q2m7']);

        $saved = $this->sendJson('PUT', '/api/v1/settings/analytics', ['ga4_measurement_id' => '', 'clarity_project_id' => 'k3x9q2m7']);

        $this->assertStatus(200);
        self::assertSame(['ga4_measurement_id' => null, 'clarity_project_id' => 'k3x9q2m7'], $saved);
    }

    public function testAnIdOfTheWrongShapeIsRefusedOnItsField(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        foreach ([
            'ga4_measurement_id' => ['UA-1234567-1', 'g-ab12cd34', 'G-AB1', 'G-AB12CD34"><script>', 'G-ABCDEFGHIJKLM'],
            'clarity_project_id' => ['ABCDEF12', 'abc', 'abc def12', 'abcdef12/../x', str_repeat('a', 21)],
        ] as $field => $values) {
            foreach ($values as $value) {
                $error = $this->sendJson('PUT', '/api/v1/settings/analytics', [$field => $value]);

                $this->assertStatus(422, "\"{$value}\" is not a {$field}.");
                self::assertSame($field, $error['violations'][0]['field'] ?? null);
            }
        }
        self::assertSame(['ga4_measurement_id' => null, 'clarity_project_id' => null], $this->getJson('/api/v1/settings/analytics'), 'Nothing was saved.');
    }

    public function testOnlyAnAdminReadsOrSavesThem(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->getJson('/api/v1/settings/analytics');
        $this->assertStatus(403);
        $this->sendJson('PUT', '/api/v1/settings/analytics', ['ga4_measurement_id' => 'G-AB12CD34']);
        $this->assertStatus(403);
    }
}
