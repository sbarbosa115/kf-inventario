<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Shared\Application\Command\CommandBus;
use App\Shared\Domain\Clock;
use Psr\Log\LoggerInterface;

/**
 * Pulls the active connections one after the other, each as its own PullShopOrders command (its own transaction): a
 * shop that cannot be read, or anything that goes wrong with one connection, never undoes or stops the others
 * (docs/pdr/prd-shops-settings.md, Decisions 11). The cron line asks only for the due ones (DUE_AFTER_MINUTES after
 * their last pull, successful or not); "Check now" for all of them.
 */
final class PullShopOrdersRunner
{
    public const DUE_AFTER_MINUTES = 15;

    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly CommandBus $commands,
        private readonly Clock $clock,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @return list<PulledShopOrders> one per connection read, by name
     */
    public function run(bool $onlyDue): array
    {
        $now = $this->clock->now();
        $due = array_values(array_filter(
            $this->connections->active(),
            static fn (ShopConnection $c): bool => !$onlyDue || self::isDue($c, $now),
        ));
        $targets = array_map(static fn (ShopConnection $c): array => [(int) $c->id(), $c->name()], $due);

        $results = [];
        foreach ($targets as [$id, $name]) {
            try {
                $pulled = $this->commands->dispatch(new PullShopOrders($id));
                $results[] = $pulled instanceof PulledShopOrders ? $pulled : new PulledShopOrders($id, $name, error: 'The pull answered nothing.');
            } catch (\Throwable $e) {
                $this->logger->error(\sprintf('The pull of shop connection %d (%s) failed: %s', $id, $name, $e->getMessage()), ['exception' => $e]);
                $results[] = new PulledShopOrders($id, $name, error: 'The pull failed in the app; see the log.');
            }
        }

        return $results;
    }

    public static function isDue(ShopConnection $connection, \DateTimeImmutable $now): bool
    {
        $last = $connection->lastPullAt();

        return null === $last || $last <= $now->modify(\sprintf('-%d minutes', self::DUE_AFTER_MINUTES));
    }
}
