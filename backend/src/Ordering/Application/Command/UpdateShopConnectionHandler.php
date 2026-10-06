<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Error\ShopKeysRequired;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Settings\Application\Port\SecretBox;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * Edits a connection. A blank consumer key or secret keeps the saved one (the form never shows them back), but only
 * while the connection stays on the same site: moved to another scheme, host or port, both keys must be typed
 * (ShopKeysRequired), so the saved ones never go to a host nobody typed them for. The webhook token and secret do
 * not change here (RotateShopWebhookSecret).
 */
final class UpdateShopConnectionHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopConnectionChecks $checks,
        private readonly SecretBox $box,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(UpdateShopConnection $command): void
    {
        $connection = $this->connections->get($command->id);
        $details = $command->details;
        $warehouse = $this->checks->check($details, $connection);
        if (!ShopConnection::sameSite($connection->siteUrl(), $details->siteUrl) && !($details->hasConsumerKey() && $details->hasConsumerSecret())) {
            throw new ShopKeysRequired();
        }
        $now = $this->clock->now();

        $connection->reconfigure(trim($details->name), $details->siteUrl, $warehouse, $details->emailPrinter, $details->active, $details->capabilities, $now);
        if ($details->hasConsumerKey() || $details->hasConsumerSecret()) {
            $connection->replaceKeys(
                $details->hasConsumerKey() ? $this->box->seal(trim((string) $details->consumerKey)) : $connection->sealedConsumerKey(),
                $details->hasConsumerSecret() ? $this->box->seal(trim((string) $details->consumerSecret)) : $connection->sealedConsumerSecret(),
                $now,
            );
        }

        $this->activity->record('shop_connection', 'Shop connection edited', [
            'id' => $command->id,
            'name' => $connection->name(),
            'site_url' => $connection->siteUrl(),
            'keys_replaced' => $details->hasConsumerKey() || $details->hasConsumerSecret(),
        ]);
    }
}
