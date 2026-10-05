<?php

namespace App\Tests\Functional\Identity;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * app:migrate-user-roles turns the PHP-serialized `user.roles` / `warehouse.urls` values (DC2Type:array) into JSON. It
 * unserializes what is in the database, so it never builds an object from it: only arrays of strings are converted.
 */
final class MigrateJsonColumnsCommandTest extends KernelTestCase
{
    public function testASerializedArrayBecomesJson(): void
    {
        $id = $this->aWarehouseWithRawUrls(serialize(['https://shop.test']));

        $this->runCommand();

        self::assertSame('["https:\/\/shop.test"]', $this->urlsOf($id));
    }

    public function testASerializedObjectIsNeverInstantiatedAndIsLeftAlone(): void
    {
        WakeUpSpy::$wokenUp = false;
        $raw = serialize(new WakeUpSpy());
        $id = $this->aWarehouseWithRawUrls($raw);

        $this->runCommand();

        self::assertFalse(WakeUpSpy::$wokenUp, 'unserialize() must not build objects from the database (allowed_classes: false).');
        self::assertSame($raw, $this->urlsOf($id), 'Not an array of values: skipped, as an unreadable value is.');
    }

    private function runCommand(): void
    {
        self::bootKernel();
        $tester = new CommandTester((new Application(self::$kernel))->find('app:migrate-user-roles'));
        $tester->execute([]);
        $tester->assertCommandIsSuccessful();
    }

    private function aWarehouseWithRawUrls(string $raw): int
    {
        $db = $this->db();
        $db->executeStatement('INSERT INTO warehouse (name, urls) VALUES (?, ?)', ['Raw', $raw]);

        return (int) $db->lastInsertId();
    }

    private function urlsOf(int $id): string
    {
        return (string) $this->db()->fetchOne('SELECT urls FROM warehouse WHERE id = ?', [$id]);
    }

    private function db(): Connection
    {
        return self::getContainer()->get(Connection::class);
    }
}
