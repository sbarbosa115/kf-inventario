<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Application\Port\ShopCredentials;
use App\Ordering\Application\Port\ShopInbox;
use App\Ordering\Domain\Error\ShopConnectionNotFound;
use App\Ordering\Domain\Error\ShopDeliveryNotFound;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Ordering\Domain\Repository\ShopDeliveryRepository;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Port\UnreadableSecret;

/**
 * What the shop-connection screens read: the connections with their health counters, whether their keys are set,
 * the webhook secret to paste (opened: the one secret an admin may read back), the opened keys a call needs, and a
 * connection's inbox.
 */
final class Shops
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopDeliveryRepository $deliveries,
        private readonly ShopOutboxRepository $outbox,
        private readonly ShopInbox $inbox,
        private readonly SecretBox $box,
    ) {
    }

    /**
     * @return list<ShopConnection> by name
     */
    public function all(): array
    {
        return $this->connections->all();
    }

    /**
     * @throws ShopConnectionNotFound
     */
    public function get(int $id): ShopConnection
    {
        return $this->connections->get($id);
    }

    public function failedDeliveries(ShopConnection $connection): int
    {
        return $this->deliveries->countFailed($connection);
    }

    public function failedPushes(ShopConnection $connection): int
    {
        return $this->outbox->countFailed($connection);
    }

    /** Both REST keys are saved (and readable with today's APP_ENCRYPTION_KEY). */
    public function hasKeys(ShopConnection $connection): bool
    {
        $keys = $this->credentials($connection);

        return '' !== $keys->consumerKey && '' !== $keys->consumerSecret;
    }

    public function webhookSecret(ShopConnection $connection): string
    {
        return $this->box->open($connection->sealedWebhookSecret());
    }

    /**
     * The opened keys of a call to the shop; an unreadable key (sealed with another APP_ENCRYPTION_KEY) is empty.
     */
    public function credentials(ShopConnection $connection): ShopCredentials
    {
        return new ShopCredentials($connection->siteUrl(), $this->open($connection->sealedConsumerKey()), $this->open($connection->sealedConsumerSecret()));
    }

    /**
     * @return list<ShopDelivery> newest first
     */
    public function deliveries(ShopConnection $connection): array
    {
        return $this->inbox->ofConnection($connection);
    }

    /**
     * @throws ShopDeliveryNotFound also when it is another connection's
     */
    public function delivery(ShopConnection $connection, int $id): ShopDelivery
    {
        return $this->deliveries->get($connection, $id);
    }

    private function open(string $sealed): string
    {
        try {
            return $this->box->open($sealed);
        } catch (UnreadableSecret) {
            return '';
        }
    }
}
