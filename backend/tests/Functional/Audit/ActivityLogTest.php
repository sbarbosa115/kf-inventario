<?php

namespace App\Tests\Functional\Audit;

use App\Audit\Domain\Model\Log;
use App\Audit\Infrastructure\Persistence\DoctrineActivityLog;
use App\Shared\Application\Port\ActivityLog;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Psr\Log\NullLogger;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

final class ActivityLogTest extends ApiTestCase
{
    use SignsIn;

    public function testARowRecordsWhoDidWhatAsTheLegacyLogDid(): void
    {
        $user = $this->aUser();
        static::getContainer()->get(TokenStorageInterface::class)->setToken(new UsernamePasswordToken($user, 'main', $user->getRoles()));

        $this->log()->record('Order', 'create', ['id' => 7]);
        $this->em()->flush();

        $log = $this->em()->getRepository(Log::class)->findOneBy(['event' => 'create']);
        self::assertNotNull($log);
        self::assertSame('order', $log->getEntity(), 'The kind of record is stored lower-cased.');
        self::assertSame('{"id":7}', $log->getDetail());
        self::assertSame($user->getId(), $log->getUser()?->getId());
    }

    public function testWithNobodySignedInNoRowIsWritten(): void
    {
        $this->log()->record('order', 'webhook');
        $this->em()->flush();

        self::assertNull($this->em()->getRepository(Log::class)->findOneBy(['event' => 'webhook']), 'log.user is NOT NULL: the webhook logs to the application log.');
    }

    private function log(): ActivityLog
    {
        // Built by hand: no use case asks the container for it yet (unused private services are dropped).
        return new DoctrineActivityLog($this->em(), static::getContainer()->get(TokenStorageInterface::class), new NullLogger());
    }
}
