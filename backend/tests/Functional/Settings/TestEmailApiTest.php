<?php

namespace App\Tests\Functional\Settings;

use App\Audit\Domain\Model\Log;
use App\Settings\Infrastructure\Mail\MailTransportFactory;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * "Send test email" (docs/pdr/prd-shops-settings.md, "API changes" › Settings): sent at once through the effective
 * server — not the queue — so the admin reads the SMTP server's own error; one call per 10 s per user.
 */
final class TestEmailApiTest extends ApiTestCase
{
    use SignsIn;

    private SpyMailTransports $servers;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->servers = new SpyMailTransports(['smtp.refusing.test' => 'Expected response code "250" but got code "550", with message "550 5.7.1 Relaying denied".']);
        static::getContainer()->set(MailTransportFactory::class, $this->servers);
    }

    public function testTheTestEmailGoesOutAtOnceThroughTheServerSavedInSettings(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->saveServer('smtp.settings.test');

        $result = $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'admin@kf.test']);

        $this->assertStatus(202);
        self::assertSame(['queued' => true, 'host' => 'smtp.settings.test'], $result, 'It names the server it went through ("Sent through …").');
        self::assertSame(['smtp.settings.test'], $this->servers->hosts(), 'Sent synchronously through the saved server.');
        $email = $this->servers->sent[0]['message'];
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('KF Inventory test email', $email->getSubject());
        self::assertSame(['admin@kf.test'], array_map(static fn (Address $a) => $a->getAddress(), $email->getTo()));
        self::assertSame('orders@kf.local', $email->getFrom()[0]->getAddress(), 'From the effective sender (env here).');
        self::assertNotEmpty($email->getTextBody());
        $this->em()->clear();
        $log = $this->em()->getRepository(Log::class)->findOneBy(['entity' => 'settings'], ['id' => 'DESC']);
        self::assertNotNull($log, 'The test email is in the activity log.');
        self::assertStringContainsString('test email', (string) $log->getEvent());
    }

    public function testWithNoServerInSettingsItGoesThroughTheEnvOne(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $result = $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'admin@kf.test']);

        $this->assertStatus(202);
        self::assertSame('null', $result['host'], 'MAILER_DSN (null://null in tests).');
        self::assertSame([], $this->servers->sent);
        self::assertEmailCount(1);
    }

    public function testAServerThatRefusesAnswers502WithItsOwnMessage(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->saveServer('smtp.refusing.test');

        $error = $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'admin@kf.test']);

        $this->assertStatus(502);
        self::assertSame('smtp_failed', $error['error']);
        self::assertStringContainsString('550 5.7.1 Relaying denied', $error['detail']['reason'], 'The admin reads why the server said no.');
        self::assertStringNotContainsString('s3cret', (string) $this->client->getResponse()->getContent(), 'Never the password.');
    }

    public function testASecondTestWithinTenSecondsIsRefused(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $this->saveServer('smtp.settings.test');

        $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'admin@kf.test']);
        $this->assertStatus(202);
        $error = $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'admin@kf.test']);

        $this->assertStatus(429, 'One test email per 10 s per user: the endpoint cannot be used to spam.');
        self::assertSame('test_email_too_soon', $error['error']);
        self::assertCount(1, $this->servers->sent);
    }

    public function testTheRecipientMustBeAnAddress(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $error = $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'not an address']);

        $this->assertStatus(422);
        self::assertSame('to', $error['violations'][0]['field']);
        self::assertSame([], $this->servers->sent);
    }

    public function testOnlyAnAdminSendsOne(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', '/api/v1/settings/email/test', ['to' => 'admin@kf.test']);

        $this->assertStatus(403);
    }

    private function saveServer(string $host): void
    {
        $this->sendJson('PUT', '/api/v1/settings/email', ['host' => $host, 'port' => 587, 'user' => 'office', 'password' => 's3cret', 'encryption' => 'tls', 'cc' => []]);
        $this->assertStatus(200, 'Saving the server.');
    }
}
