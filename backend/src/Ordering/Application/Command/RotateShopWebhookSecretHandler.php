<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Settings\Application\Port\SecretBox;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * A new signing secret for the connection's webhook (32 random bytes, hex). Deliveries signed with the old one are
 * refused (401, inbox `bad_signature`) until it is pasted in WooCommerce; the URL does not change.
 */
final class RotateShopWebhookSecretHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly SecretBox $box,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(RotateShopWebhookSecret $command): void
    {
        $connection = $this->connections->get($command->id);
        $connection->rotateWebhookSecret($this->box->seal(bin2hex(random_bytes(32))), $this->clock->now());

        $this->activity->record('shop_connection', 'Shop webhook secret rotated', ['id' => $command->id, 'name' => $connection->name()]);
    }
}
