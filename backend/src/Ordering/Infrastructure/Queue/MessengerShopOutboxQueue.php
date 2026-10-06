<?php

namespace App\Ordering\Infrastructure\Queue;

use App\Ordering\Application\Command\PushShopUpdate;
use App\Ordering\Application\Port\ShopOutboxQueue;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use App\Shared\Domain\Clock;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Messenger\Stamp\DelayStamp;
use Symfony\Component\Messenger\Stamp\TransportNamesStamp;

/**
 * The `shops` queue (config/packages/messenger.yaml): PushShopUpdate with the row's id, delayed until the row's
 * next_attempt_at. It is sent on the command bus, so the worker handles it as a command (one transaction), and sent
 * inside the caller's transaction: the doctrine transport writes the message to the same database, so the row and
 * its message are committed together, or neither is.
 */
final class MessengerShopOutboxQueue implements ShopOutboxQueue
{
    public const TRANSPORT = 'shops';

    public function __construct(
        #[Autowire(service: 'command.bus')]
        private readonly MessageBusInterface $bus,
        private readonly ShopOutboxRepository $outbox,
        private readonly Clock $clock,
    ) {
    }

    public function enqueue(int $outboxId): void
    {
        $stamps = [new TransportNamesStamp([self::TRANSPORT])];
        $due = $this->outbox->get($outboxId)->nextAttemptAt();
        if (null !== $due) {
            $wait = $due->getTimestamp() - $this->clock->now()->getTimestamp();
            if ($wait > 0) {
                $stamps[] = new DelayStamp($wait * 1000);
            }
        }

        $this->bus->dispatch(new PushShopUpdate($outboxId), $stamps);
    }
}
