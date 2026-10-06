<?php

namespace App\Tests\Functional\Settings;

use App\Settings\Application\Port\SecretBox;
use App\Settings\Domain\Model\AppSetting;
use App\Settings\Infrastructure\Mail\MailTransportFactory;
use App\Tests\Functional\Ordering\OrderingFixtures;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;

/**
 * Every email the app sends (the queued order email, the legacy pages' mail, the test email) leaves through the SMTP
 * server saved in Settings › Email when there is one, else through MAILER_DSN (docs/pdr/prd-shops-settings.md,
 * Decisions 1 and 3): Settings' transport decorates Symfony's mailer.transports, so Shared's mailer does not change.
 */
final class SettingsMailTransportTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    private SpyMailTransports $servers;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->servers = new SpyMailTransports();
        static::getContainer()->set(MailTransportFactory::class, $this->servers);
    }

    public function testWithNoServerInSettingsTheEnvTransportSends(): void
    {
        $this->transport()->send($this->anEmail());

        self::assertSame([], $this->servers->built, 'Nothing saved in Settings: MAILER_DSN (null://null in tests) sends it.');
        self::assertEmailCount(1);
    }

    public function testTheServerSavedInSettingsWinsOverTheEnv(): void
    {
        $this->saveServer('smtp://office:secret@smtp.settings.test:587');

        $this->transport()->send($this->anEmail());

        self::assertSame(['smtp.settings.test'], $this->servers->hosts(), 'A saved server wins (Decisions 3).');
        self::assertSame('smtp://office:secret@smtp.settings.test:587', $this->servers->built[0], 'Built from the opened (unsealed) DSN.');
        self::assertEmailCount(0, message: 'The env transport did not send it too.');
    }

    public function testAChangedServerAppliesToTheNextEmailWithoutARestart(): void
    {
        $this->saveServer('smtp://smtp.first.test:25');
        $this->transport()->send($this->anEmail());

        $this->saveServer('smtp://smtp.second.test:25');
        $this->transport()->send($this->anEmail());

        $this->saveServer(null);
        $this->transport()->send($this->anEmail());

        self::assertSame(['smtp.first.test', 'smtp.second.test'], $this->servers->hosts(), 'The server is read at send time, so the worker picks a change up.');
        self::assertEmailCount(1, message: 'A cleared server: MAILER_DSN applies again.');
    }

    public function testItNamesTheServerItSendsThroughWithoutTheCredentials(): void
    {
        $this->saveServer('smtp://office:secret@smtp.settings.test:587');

        self::assertStringNotContainsString('secret', (string) $this->transport());
        self::assertStringContainsString('smtp.settings.test', (string) $this->transport());
    }

    /** MAIL-04: an order email queued after the SMTP server changed goes through the new server. */
    public function testAQueuedOrderEmailGoesThroughTheServerSavedInSettings(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $customer = $this->aCustomer();
        $product = $this->aProduct('KF-A', $warehouse);
        $this->saveServer('smtp://smtp.settings.test:587');

        $this->placeOrder($warehouse, $customer, [[$product, 1]], ['code' => 'WEB-2001']);

        self::assertSame(['smtp.settings.test'], $this->servers->hosts(), 'The mail queue (sync:// in tests) hands the order email to the Settings server.');
        $email = $this->servers->sent[0]['message'];
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('Order #WEB-2001 was created', $email->getSubject());
    }

    private function transport(): TransportInterface
    {
        return static::getContainer()->get('mailer.transports');
    }

    private function saveServer(?string $dsn): void
    {
        $sealed = null === $dsn ? null : static::getContainer()->get(SecretBox::class)->seal($dsn);
        $em = $this->em();
        $row = $em->find(AppSetting::class, 'email.dsn');
        if (null === $row) {
            $em->persist(new AppSetting('email.dsn', $sealed, true, new \DateTimeImmutable()));
        } else {
            $row->change($sealed, true, new \DateTimeImmutable());
        }
        $em->flush();
        $em->clear();
    }

    private function anEmail(): Email
    {
        return (new Email())->from('orders@kf.local')->to('someone@kf.test')->subject('Hello')->text('Hi');
    }
}
