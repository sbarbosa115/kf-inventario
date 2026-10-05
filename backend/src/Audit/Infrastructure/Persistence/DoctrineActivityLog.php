<?php

namespace App\Audit\Infrastructure\Persistence;

use App\Audit\Domain\Model\Log;
use App\Identity\Domain\Model\User;
use App\Shared\Application\Port\ActivityLog;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * The log rows the legacy LogService wrote, the same way (lower-cased entity, JSON detail or an empty string), in the
 * caller's transaction instead of a flush of its own. A row needs a user (log.user is NOT NULL): with nobody signed in
 * (the WooCommerce webhook) the entry goes to the application log instead.
 */
final class DoctrineActivityLog implements ActivityLog
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly TokenStorageInterface $tokens,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function record(string $entity, string $event, array $detail = []): void
    {
        $user = $this->tokens->getToken()?->getUser();

        if (!$user instanceof User) {
            $this->logger->info('Activity without a signed-in user: {entity} {event}', ['entity' => $entity, 'event' => $event, 'detail' => $detail]);

            return;
        }

        $log = new Log();
        $log->setCreatedAt(new \DateTime('now'));
        $log->setUser($user);
        $log->setEvent($event);
        $log->setEntity(mb_strtolower($entity));
        $log->setDetail([] === $detail ? '' : (string) json_encode($detail));
        $this->em->persist($log);
    }
}
