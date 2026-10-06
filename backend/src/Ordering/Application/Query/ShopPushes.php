<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Domain\Error\ShopConnectionNotFound;
use App\Ordering\Domain\Error\ShopOutboxNotFound;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Ordering\Domain\Repository\ShopOutboxRepository;

/**
 * What the app wrote, or tries to write, to a connection's shop (the outbox), for its health panel.
 */
final class ShopPushes
{
    public const STATUSES = [ShopOutbox::STATUS_PENDING, ShopOutbox::STATUS_SENT, ShopOutbox::STATUS_FAILED];

    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopOutboxRepository $outbox,
    ) {
    }

    /**
     * @return list<ShopOutbox> newest first
     *
     * @throws ShopConnectionNotFound
     */
    public function of(int $connectionId, string $status): array
    {
        return $this->outbox->ofConnection($this->connections->get($connectionId), $status);
    }

    /**
     * @throws ShopConnectionNotFound|ShopOutboxNotFound also when the row is another connection's
     */
    public function get(int $connectionId, int $outboxId): ShopOutbox
    {
        $connection = $this->connections->get($connectionId);
        $entry = $this->outbox->get($outboxId);
        if ($entry->connection() !== $connection) {
            throw new ShopOutboxNotFound();
        }

        return $entry;
    }
}
