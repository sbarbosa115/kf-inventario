<?php

namespace App\Tests\Functional\Ordering;

use App\Audit\Domain\Model\Log;
use App\Settings\Domain\Model\AppSetting;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * The printer's email of a new order (legacy NotificationService::sendOrderByEmail): one email to
 * MAILER_PRINTER_ADDRESS, sales@klassicfab.com in cc, "Order #<code> was created", the order PDF attached. Queued on
 * the `mail` transport (sync:// in tests, so it is sent before the response).
 */
final class OrderEmailTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    private const MAILER_ENV = ['MAILER_FROM_ADDRESS', 'MAILER_FROM_NAME', 'MAILER_PRINTER_ADDRESS'];

    /** @var array<string, array{mixed, mixed}> */
    private array $savedEnv = [];

    protected function tearDown(): void
    {
        foreach ($this->savedEnv as $name => [$server, $env]) {
            if (null === $server) {
                unset($_SERVER[$name]);
            } else {
                $_SERVER[$name] = $server;
            }
            if (null === $env) {
                unset($_ENV[$name]);
            } else {
                $_ENV[$name] = $env;
            }
        }
        parent::tearDown();
    }

    public function testPlacingAnOrderEmailsThePrinterWithThePdf(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]], ['code' => 'WEB-1001']);

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame(['printer@kf.local'], array_map(static fn (Address $a) => $a->getAddress(), $email->getTo()), 'To MAILER_PRINTER_ADDRESS.');
        self::assertSame(['sales@klassicfab.com'], array_map(static fn (Address $a) => $a->getAddress(), $email->getCc()), 'ordering.order_email.cc');
        self::assertSame('orders@kf.local', $email->getFrom()[0]->getAddress());
        self::assertSame('KF Inventory', $email->getFrom()[0]->getName());
        self::assertSame('Order #WEB-1001 was created', $email->getSubject());
        self::assertNotEmpty($email->getTextBody());
        $attachments = $email->getAttachments();
        self::assertCount(1, $attachments, 'One attachment: the order PDF.');
        self::assertSame("order-{$id}.pdf", $attachments[0]->getFilename());
        self::assertSame('application/pdf', $attachments[0]->getMediaType().'/'.$attachments[0]->getMediaSubtype());
        self::assertStringStartsWith('%PDF', $attachments[0]->getBody());
    }

    public function testTheSettingsSenderPrinterAndCcWinOverTheEnv(): void
    {
        $at = new \DateTimeImmutable();
        $this->save(
            new AppSetting('email.from_address', 'office@kf.local', false, $at),
            new AppSetting('email.from_name', 'KF Office', false, $at),
            new AppSetting('email.printer_address', 'office-printer@kf.local', false, $at),
            new AppSetting('email.cc', '["boss@kf.local","sales@kf.local"]', false, $at),
        );
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();

        $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]], ['code' => 'WEB-1002']);

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame(['office-printer@kf.local'], array_map(static fn (Address $a) => $a->getAddress(), $email->getTo()), 'Settings › Email first, env fallback (Decisions 3).');
        self::assertSame(['boss@kf.local', 'sales@kf.local'], array_map(static fn (Address $a) => $a->getAddress(), $email->getCc()));
        self::assertSame('office@kf.local', $email->getFrom()[0]->getAddress());
        self::assertSame('KF Office', $email->getFrom()[0]->getName());
    }

    public function testAnEmptySettingFallsBackToTheEnv(): void
    {
        $this->save(new AppSetting('email.printer_address', null, false, new \DateTimeImmutable()));
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();

        $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame(['printer@kf.local'], array_map(static fn (Address $a) => $a->getAddress(), $email->getTo()), 'An empty row means "not set here".');
    }

    public function testASenderAddressSavedWithoutANameTakesTheNameFromTheEnv(): void
    {
        // Settings › Email says "each value you leave empty falls back to the server's setting": an address alone must
        // not leave the sender without a name (the email was not built at all, smoke case MAIL-03).
        $this->save(new AppSetting('email.from_address', 'office@kf.local', false, new \DateTimeImmutable()));
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();

        $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('office@kf.local', $email->getFrom()[0]->getAddress());
        self::assertSame('KF Inventory', $email->getFrom()[0]->getName());
    }

    public function testEditingAnOrderSendsNoEmail(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $customer = $this->aCustomer();
        $a = $this->aProduct('KF-A', $warehouse);
        $id = $this->placeOrder($warehouse, $customer, [[$a, 1]]);

        $this->sendJson('PUT', '/api/v1/orders/'.$id, $this->orderPayload($warehouse, $customer, [[$a, 2]]));

        $this->assertStatus(200);
        self::assertEmailCount(0, message: 'Only a new order is printed.');
    }

    public function testWithoutTheMailerSettingsNoEmailIsSentAndTheFailureIsLogged(): void
    {
        $this->withoutMailerSettings();
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();

        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);

        self::assertEmailCount(0);
        $this->em()->clear();
        $log = $this->em()->getRepository(Log::class)->findOneBy(['entity' => 'mail']);
        self::assertNotNull($log, 'The failed email is a log row "mail", as before.');
        self::assertStringContainsString("order {$id}", (string) $log->getEvent());
        $this->getJson('/api/v1/orders/'.$id);
        $this->assertStatus(200, 'The order is placed all the same.');
    }

    private function withoutMailerSettings(): void
    {
        self::ensureKernelShutdown();
        foreach (self::MAILER_ENV as $name) {
            $this->savedEnv[$name] = [$_SERVER[$name] ?? null, $_ENV[$name] ?? null];
            $_SERVER[$name] = '';
            $_ENV[$name] = '';
        }
        $this->client = static::createClient();
    }
}
