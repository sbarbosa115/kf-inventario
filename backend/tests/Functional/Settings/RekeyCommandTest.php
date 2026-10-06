<?php

namespace App\Tests\Functional\Settings;

use App\Ordering\Domain\Model\ShopConnection;
use App\Settings\Application\Port\SecretBox;
use App\Settings\Domain\Model\AppSetting;
use App\Settings\Infrastructure\Crypto\SodiumSecretBox;
use App\Tests\Functional\Ordering\OrderingFixtures;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * Key rotation (docs/pdr/prd-shops-settings.md, Security): after APP_ENCRYPTION_KEY changes, `app:settings:rekey
 * --old-key=<the previous key>` re-seals every secret the app keeps — the settings' and the shop connections' — with
 * the new one. All or nothing; running it twice changes nothing.
 */
final class RekeyCommandTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    private const OLD_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    private const OTHER_KEY = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

    public function testEverySealedSecretIsResealedWithTheCurrentKey(): void
    {
        $old = new SodiumSecretBox(self::OLD_KEY);
        $at = new \DateTimeImmutable();
        $this->save(
            new AppSetting('email.dsn', $old->seal('smtp://office:secret@smtp.office.test:587'), true, $at),
            new AppSetting('email.printer_address', 'printer@office.test', false, $at),
        );
        $shopId = $this->aShop($old->seal('ck_123'), $old->seal('cs_456'), $old->seal('whsec_789'));

        $tester = $this->rekey(self::OLD_KEY);

        self::assertSame(Command::SUCCESS, $tester->getStatusCode(), $tester->getDisplay());
        self::assertStringContainsString('4 secret(s) re-sealed', $tester->getDisplay());
        $box = static::getContainer()->get(SecretBox::class);
        $db = static::getContainer()->get(Connection::class);
        $dsn = (string) $db->fetchOne("SELECT value FROM app_setting WHERE `key` = 'email.dsn'");
        self::assertSame('smtp://office:secret@smtp.office.test:587', $box->open($dsn), 'The current key opens it now.');
        self::assertSame('printer@office.test', $db->fetchOne("SELECT value FROM app_setting WHERE `key` = 'email.printer_address'"), 'A plain setting is left alone.');
        $shop = $db->fetchAssociative('SELECT consumer_key, consumer_secret, webhook_secret FROM shop_connection WHERE id = ?', [$shopId]);
        self::assertIsArray($shop);
        self::assertSame(['ck_123', 'cs_456', 'whsec_789'], [$box->open($shop['consumer_key']), $box->open($shop['consumer_secret']), $box->open($shop['webhook_secret'])], 'The shop connections\' keys and webhook secret too.');
        foreach (['office:secret', 'ck_123', 'cs_456', 'whsec_789'] as $plain) {
            self::assertStringNotContainsString($plain, $tester->getDisplay(), 'Never a secret on screen.');
        }

        $again = $this->rekey(self::OLD_KEY);
        self::assertSame(Command::SUCCESS, $again->getStatusCode());
        self::assertStringContainsString('0 secret(s) re-sealed, 4 already sealed with the current key', $again->getDisplay(), 'Running it twice changes nothing.');
    }

    public function testASecretNeitherKeyOpensStopsItAndNothingChanges(): void
    {
        $old = new SodiumSecretBox(self::OLD_KEY);
        $other = new SodiumSecretBox(self::OTHER_KEY);
        $at = new \DateTimeImmutable();
        $this->save(
            new AppSetting('email.dsn', $old->seal('smtp://smtp.office.test'), true, $at),
            new AppSetting('shops.mystery', $other->seal('?'), true, $at),
        );
        $before = static::getContainer()->get(Connection::class)->fetchOne("SELECT value FROM app_setting WHERE `key` = 'email.dsn'");

        $tester = $this->rekey(self::OLD_KEY);

        self::assertSame(Command::FAILURE, $tester->getStatusCode());
        self::assertStringContainsString('shops.mystery', $tester->getDisplay(), 'It names what it cannot open.');
        self::assertSame($before, static::getContainer()->get(Connection::class)->fetchOne("SELECT value FROM app_setting WHERE `key` = 'email.dsn'"), 'All or nothing.');
    }

    public function testTheOldKeyMustBeAKey(): void
    {
        foreach (['', 'short', str_repeat('zz', 32)] as $key) {
            $tester = $this->rekey($key);

            self::assertSame(Command::INVALID, $tester->getStatusCode(), "\"{$key}\" is not 64 hex characters.");
            self::assertStringContainsString('64 hex', $tester->getDisplay());
        }
    }

    private function rekey(string $oldKey): CommandTester
    {
        $tester = new CommandTester((new Application(self::$kernel ?? self::bootKernel()))->find('app:settings:rekey'));
        $tester->execute(['--old-key' => $oldKey]);
        $this->em()->clear();

        return $tester;
    }

    private function aShop(string $key, string $secret, string $webhookSecret): int
    {
        $shop = new ShopConnection('Rekey shop', 'https://rekey.test', $key, $secret, str_repeat('cd', 32), $webhookSecret, $this->aWarehouse(), false, true, [], new \DateTimeImmutable());
        $this->em()->persist($shop);
        $this->em()->flush();

        return (int) $shop->id();
    }
}
