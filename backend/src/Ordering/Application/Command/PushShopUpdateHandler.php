<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\ShopGateway;
use App\Ordering\Application\Port\ShopOutboxQueue;
use App\Ordering\Application\Query\Shops;
use App\Ordering\Application\Query\ShopsTester;
use App\Ordering\Domain\Error\ShopOutboxNotFound;
use App\Ordering\Domain\Error\ShopUnreachable;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/**
 * Writes one outbox row to its shop (docs/pdr/prd-shops-settings.md, Decisions 10): the order's status
 * (`order_status`) or an order note (`order_note`, private on the shop, so the pull never reads it back).
 *
 * The outcome is recorded on the row, never thrown — a throw would roll the record back with the transaction:
 * sent; or tried again RETRY_MINUTES later (queued again with that delay); or, at the MAX_ATTEMPTS-th failure (or
 * whenever the connection no longer allows the write), `failed`, in the connection's health, until an admin presses
 * Retry. Refused keys (HTTP 401) are named in the health at once (`keys_read_only`: the README's read-only keys).
 *
 * A message that is no longer the row's — the row was sent, failed for good, or rescheduled by a Retry — does
 * nothing, so a delayed message and a Retry never push twice.
 */
final class PushShopUpdateHandler implements CommandHandler
{
    public const MAX_ATTEMPTS = 3;
    /** The waits after the first and the second failure. */
    public const RETRY_MINUTES = [1, 5];
    public const FAILURE_CODE = 'push_failed';
    /** A delayed message may come this early (the queue's clock and the app's). */
    private const EARLY_SECONDS = 5;

    public function __construct(
        private readonly ShopOutboxRepository $outbox,
        private readonly ShopOrderLinkRepository $links,
        private readonly Shops $shops,
        private readonly ShopGateway $gateway,
        private readonly ShopOutboxQueue $queue,
        private readonly Clock $clock,
    ) {
    }

    public function __invoke(PushShopUpdate $command): void
    {
        try {
            $entry = $this->outbox->get($command->outboxId);
        } catch (ShopOutboxNotFound) {
            return;
        }
        $now = $this->clock->now();
        $due = $entry->nextAttemptAt();
        if (ShopOutbox::STATUS_PENDING !== $entry->status() || (null !== $due && $due > $now->modify(\sprintf('+%d seconds', self::EARLY_SECONDS)))) {
            return;
        }

        $connection = $entry->connection();
        if (!$connection->can($entry->capability())) {
            $entry->attemptFailed('The connection is inactive, or no longer allows this update.', $now, null);

            return;
        }
        $link = $this->links->ofOrder((int) $entry->order()->getId());
        if (null === $link || $link->connection() !== $connection) {
            $entry->attemptFailed('The order is not linked to this shop.', $now, null);

            return;
        }

        try {
            $keys = $this->shops->credentials($connection);
            $payload = $entry->payload();
            match ($entry->capability()) {
                ShopCapability::OrderStatus => $this->gateway->updateOrderStatus($keys, $link->remoteOrderId(), self::text($payload, 'status')),
                ShopCapability::OrderNote => $this->gateway->addOrderNote($keys, $link->remoteOrderId(), self::text($payload, 'note')),
            };
        } catch (ShopUnreachable $e) {
            $this->failed($entry, $e, $now);

            return;
        }

        $entry->sent($now);
        if (ShopCapability::OrderStatus === $entry->capability()) {
            $link->pushed(self::text($entry->payload(), 'status'));
        }
    }

    private function failed(ShopOutbox $entry, ShopUnreachable $e, \DateTimeImmutable $now): void
    {
        $attempt = $entry->attempts() + 1;
        $wait = $attempt < self::MAX_ATTEMPTS ? (self::RETRY_MINUTES[$attempt - 1] ?? null) : null;
        $entry->attemptFailed($e->reason(), $now, null === $wait ? null : $now->modify(\sprintf('+%d minutes', $wait)));

        $connection = $entry->connection();
        if (401 === $e->httpStatus()) {
            $connection->recordFailure($now, ShopsTester::KEYS_READ_ONLY, $e->reason());
        } elseif (null === $wait) {
            $connection->recordFailure($now, self::FAILURE_CODE, $e->reason());
        }
        if (null !== $wait) {
            $this->queue->enqueue((int) $entry->id());
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function text(array $payload, string $key): string
    {
        $value = $payload[$key] ?? '';

        return \is_scalar($value) ? (string) $value : '';
    }
}
