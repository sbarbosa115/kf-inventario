<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Settings\Application\Port\SecretBox;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * A new shop connection: its webhook token (the path) and signing secret are generated here, 32 random bytes each in
 * hex; the keys and the secret are sealed (SecretBox) before they reach the entity.
 */
final class CreateShopConnectionHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopConnectionChecks $checks,
        private readonly SecretBox $box,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(CreateShopConnection $command): CreatedShopConnection
    {
        $details = $command->details;
        $warehouse = $this->checks->check($details);
        $secret = bin2hex(random_bytes(32));

        $connection = new ShopConnection(
            name: trim($details->name),
            siteUrl: $details->siteUrl,
            sealedConsumerKey: $this->box->seal(trim((string) $details->consumerKey)),
            sealedConsumerSecret: $this->box->seal(trim((string) $details->consumerSecret)),
            webhookToken: bin2hex(random_bytes(32)),
            sealedWebhookSecret: $this->box->seal($secret),
            warehouse: $warehouse,
            emailPrinter: $details->emailPrinter,
            active: $details->active,
            capabilities: $details->capabilities,
            at: $this->clock->now(),
        );
        $this->connections->add($connection);

        $this->activity->record('shop_connection', 'Shop connection created', ['name' => $connection->name(), 'site_url' => $connection->siteUrl()]);

        return new CreatedShopConnection($connection, $secret);
    }
}
