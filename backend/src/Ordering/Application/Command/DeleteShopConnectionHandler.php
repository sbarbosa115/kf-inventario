<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\ShopInbox;
use App\Ordering\Domain\Error\ShopHasOrders;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * Deletes a connection no order came from, with its inbox. One that orders came from is refused (they name it, and
 * its outbox and shop notes point at it): it is deactivated instead.
 */
final class DeleteShopConnectionHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopOrderLinkRepository $links,
        private readonly ShopInbox $inbox,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(DeleteShopConnection $command): void
    {
        $connection = $this->connections->get($command->id);
        if ($this->links->hasLinks($connection)) {
            throw new ShopHasOrders();
        }

        $this->inbox->removeOfConnection($connection);
        $this->connections->remove($connection);

        $this->activity->record('shop_connection', 'Shop connection deleted', ['id' => $command->id, 'name' => $connection->name(), 'site_url' => $connection->siteUrl()]);
    }
}
