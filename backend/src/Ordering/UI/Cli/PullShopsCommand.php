<?php

namespace App\Ordering\UI\Cli;

use App\Ordering\Application\Command\PullShopOrdersRunner;
use App\Ordering\Application\Command\PurgeShopDeliveries;
use App\Shared\Application\Command\CommandBus;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * php bin/console app:shops:pull [--if-due]: the shops' catch-up pull, run by the cron line every minute before the
 * queues are drained (deploy/cpanel-update.sh; docs/pdr/prd-shops-settings.md, Decisions 11). With --if-due only the
 * connections whose last pull is 15 minutes old or more are read; without it every active connection is. Each run
 * also deletes the failed deliveries received more than 90 days ago.
 *
 * Two runs never overlap (a lock file in var/, besides the cron line's flock): the second exits at once. A shop that
 * cannot be read is reported and recorded in its connection's health; the command still exits 0, so the cron line
 * goes on to drain the queues.
 */
#[AsCommand(name: 'app:shops:pull', description: 'Pulls the shops\' new orders (every active connection; --if-due: the ones due)')]
final class PullShopsCommand
{
    public function __construct(
        private readonly PullShopOrdersRunner $runner,
        private readonly CommandBus $commands,
        #[Autowire('%kernel.project_dir%/var/shops-pull.lock')]
        private readonly string $lockFile,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option('Only the connections due (15 minutes after their last pull).')] bool $ifDue = false,
    ): int {
        $lock = @fopen($this->lockFile, 'c');
        if (false === $lock || !flock($lock, \LOCK_EX | \LOCK_NB)) {
            $io->writeln('Another pull is running.');

            return Command::SUCCESS;
        }

        try {
            foreach ($this->runner->run($ifDue) as $pulled) {
                $io->writeln(null === $pulled->error
                    ? \sprintf('%s: %d imported, %d skipped.', $pulled->name, $pulled->imported, $pulled->skipped)
                    : \sprintf('%s: %s', $pulled->name, $pulled->error));
            }
            $purged = $this->commands->dispatch(new PurgeShopDeliveries());
            if (\is_int($purged) && $purged > 0) {
                $io->writeln(\sprintf('%d failed deliveries older than %d days deleted.', $purged, PurgeShopDeliveries::KEEP_DAYS));
            }
        } finally {
            flock($lock, \LOCK_UN);
            fclose($lock);
        }

        return Command::SUCCESS;
    }
}
