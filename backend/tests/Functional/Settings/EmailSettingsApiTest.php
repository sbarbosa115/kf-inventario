<?php

namespace App\Tests\Functional\Settings;

use App\Audit\Domain\Model\Log;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Doctrine\DBAL\Connection;

/**
 * Settings › Email (docs/pdr/prd-shops-settings.md, "API changes" › Settings, Decisions 3): the SMTP server, the
 * sender, the printer and the cc, each falling back to the env when empty. The password is sealed at rest and never
 * read back.
 */
final class EmailSettingsApiTest extends ApiTestCase
{
    use SignsIn;

    private const SERVER = ['host' => 'smtp.office.test', 'port' => 587, 'user' => 'office', 'password' => 'p@ss w0rd', 'encryption' => 'tls'];

    public function testSavingAnswersWhatIsSavedAndNeverThePassword(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $saved = $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + [
            'from_address' => 'office@kf.test', 'from_name' => 'KF Office', 'printer_address' => 'printer@office.test', 'cc' => ['boss@kf.test', '', 'sales@kf.test'],
        ]);

        $this->assertStatus(200);
        self::assertSame('smtp.office.test', $saved['dsn_host']);
        self::assertSame(587, $saved['dsn_port']);
        self::assertSame('office', $saved['dsn_user']);
        self::assertTrue($saved['has_password']);
        self::assertSame('tls', $saved['encryption']);
        self::assertSame('office@kf.test', $saved['from_address']);
        self::assertSame('KF Office', $saved['from_name']);
        self::assertSame('printer@office.test', $saved['printer_address']);
        self::assertSame(['boss@kf.test', 'sales@kf.test'], $saved['cc'], 'Blank cc entries are dropped.');
        self::assertSame(['dsn' => 'settings', 'from' => 'settings', 'printer' => 'settings', 'cc' => 'settings'], $saved['source']);
        self::assertStringNotContainsString('p@ss w0rd', (string) $this->client->getResponse()->getContent(), 'Never the password.');
        self::assertStringNotContainsString('p%40ss', (string) $this->client->getResponse()->getContent(), 'Nor the DSN that holds it.');
        self::assertSame($saved, $this->getJson('/api/v1/settings/email'), 'GET answers the same.');
    }

    public function testTheServerIsSealedAtRest(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + ['cc' => []]);

        $row = static::getContainer()->get(Connection::class)->fetchAssociative("SELECT value, encrypted FROM app_setting WHERE `key` = 'email.dsn'");
        self::assertIsArray($row);
        self::assertStringStartsWith('v1:', (string) $row['value'], 'SecretBox: "v1:" + base64(nonce‖box).');
        self::assertSame(1, (int) $row['encrypted']);
        self::assertStringNotContainsString('office.test', (string) $row['value'], 'The whole DSN is sealed, not only the password.');
    }

    public function testABlankPasswordKeepsTheSavedOneForTheSameServer(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + ['cc' => []]);

        $saved = $this->sendJson('PUT', '/api/v1/settings/email', ['password' => '', 'port' => 2525] + self::SERVER + ['cc' => []]);

        $this->assertStatus(200);
        self::assertTrue($saved['has_password'], '"Leave blank to keep the current password".');
        self::assertSame(2525, $saved['dsn_port']);
        $this->sendJson('PUT', '/api/v1/settings/email', ['password' => null] + self::SERVER + ['cc' => []]);
        self::assertTrue($this->getJson('/api/v1/settings/email')['has_password'], 'An absent password keeps it too.');
    }

    public function testABlankPasswordIsNotHandedToAnotherServer(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + ['cc' => []]);

        $saved = $this->sendJson('PUT', '/api/v1/settings/email', ['host' => 'smtp.elsewhere.test', 'password' => ''] + self::SERVER + ['cc' => []]);

        $this->assertStatus(200);
        self::assertSame('smtp.elsewhere.test', $saved['dsn_host']);
        self::assertFalse($saved['has_password'], 'The saved password belongs to the old server: a new host needs it typed again, so it never leaves for a host nobody typed it for.');
    }

    public function testEverythingEmptyClearsTheSettingsAndTheEnvAppliesAgain(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + ['from_address' => 'office@kf.test', 'printer_address' => 'printer@office.test', 'cc' => ['boss@kf.test']]);

        $cleared = $this->sendJson('PUT', '/api/v1/settings/email', ['host' => '', 'port' => null, 'user' => '', 'password' => '', 'encryption' => 'tls', 'from_address' => '', 'from_name' => '', 'printer_address' => '', 'cc' => []]);

        $this->assertStatus(200);
        self::assertNull($cleared['dsn_host']);
        self::assertFalse($cleared['has_password']);
        self::assertNull($cleared['from_address']);
        self::assertNull($cleared['printer_address']);
        self::assertSame([], $cleared['cc']);
        self::assertSame(['dsn' => 'env', 'from' => 'env', 'printer' => 'env', 'cc' => 'env'], $cleared['source'], 'Decisions 3: empty → env.');
    }

    public function testEachValueSaysWhereItComesFrom(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $saved = $this->sendJson('PUT', '/api/v1/settings/email', ['host' => '', 'encryption' => 'tls', 'printer_address' => 'printer@office.test', 'cc' => []]);

        $this->assertStatus(200);
        self::assertSame(['dsn' => 'env', 'from' => 'env', 'printer' => 'settings', 'cc' => 'env'], $saved['source']);
        self::assertSame('null', $saved['env_host'], 'MAILER_DSN\'s host (null://null in tests).');
    }

    public function testABadAddressOrServerIsRefusedOnItsField(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        foreach ([
            'from_address' => ['from_address' => 'not an address'],
            'printer_address' => ['printer_address' => 'printer@'],
            'cc[1]' => ['cc' => ['boss@kf.test', 'nope']],
            'host' => ['host' => 'smtp://smtp.office.test'],
            'port' => ['port' => 70000],
            'encryption' => ['encryption' => 'starttls'],
        ] as $field => $bad) {
            $error = $this->sendJson('PUT', '/api/v1/settings/email', $bad + self::SERVER + ['cc' => []]);

            $this->assertStatus(422, "{$field} is checked.");
            self::assertSame($field, $error['violations'][0]['field'] ?? null, "The violation names {$field}.");
        }
        foreach (['office@smtp.test', 'smtp.test/x', 'smtp test', 'smtp.test?x=1', 'smtp.test:25'] as $host) {
            $error = $this->sendJson('PUT', '/api/v1/settings/email', ['host' => $host] + self::SERVER + ['cc' => []]);
            $this->assertStatus(422, "\"{$host}\" is a host name only: nothing else can be slipped into the DSN.");
            self::assertSame('host', $error['violations'][0]['field'] ?? null);
        }
        self::assertNull($this->getJson('/api/v1/settings/email')['dsn_host'], 'Nothing was saved.');
    }

    public function testTheChangeIsLoggedByKeyNeverByValue(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + ['printer_address' => 'printer@office.test', 'cc' => []]);

        $this->em()->clear();
        $log = $this->em()->getRepository(Log::class)->findOneBy(['entity' => 'settings'], ['id' => 'DESC']);
        self::assertNotNull($log, 'Who changed which setting (Security › Logging).');
        $detail = (string) $log->getDetail();
        self::assertStringContainsString('email.dsn', $detail);
        self::assertStringContainsString('email.printer_address', $detail);
        self::assertStringNotContainsString('email.from_name', $detail, 'Only the keys that changed.');
        self::assertStringNotContainsString('p@ss', $detail);
        self::assertStringNotContainsString('printer@office.test', $detail, 'Keys, not values.');
    }

    public function testOnlyAnAdminReadsOrSavesIt(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS', 'ROLE_MANAGE_USERS']);

        $this->getJson('/api/v1/settings/email');
        $this->assertStatus(403);
        $this->sendJson('PUT', '/api/v1/settings/email', self::SERVER + ['cc' => []]);
        $this->assertStatus(403);
    }
}
