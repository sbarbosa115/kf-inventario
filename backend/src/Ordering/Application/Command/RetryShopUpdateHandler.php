<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\ShopOutboxQueue;
use App\Ordering\Domain\Error\ShopConnectionNotFound;
use App\Ordering\Domain\Error\ShopOutboxNotFound;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

final class RetryShopUpdateHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopOutboxRepository $outbox,
        private readonly ShopOutboxQueue $queue,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @throws ShopConnectionNotFound|ShopOutboxNotFound also when the row is another connection's
     */
    public function __invoke(RetryShopUpdate $command): void
    {
        $connection = $this->connections->get($command->connectionId);
        $entry = $this->outbox->get($command->outboxId);
        if ($entry->connection() !== $connection) {
            throw new ShopOutboxNotFound();
        }
        if (ShopOutbox::STATUS_SENT === $entry->status()) {
            return;
        }

        $entry->requeue($this->clock->now());
        $this->queue->enqueue($command->outboxId);
    }
}
