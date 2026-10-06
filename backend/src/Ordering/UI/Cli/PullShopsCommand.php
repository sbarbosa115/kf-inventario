<?php

namespace App\Ordering\UI\Cli;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * php bin/console app:shops:pull [--if-due]: the shops' catch-up pull, run by the cron line every minute before the
 * queues are drained (deploy/cpanel-update.sh; docs/pdr/prd-shops-settings.md, Decisions 11). With --if-due only the
 * connections whose last pull is 15 minutes old or more are read.
 *
 * Item 0's stub: it exits 0 and does nothing, so the cron line works from the first deploy. Item 5b (shops-sync-api)
 * pulls the connections and purges the inbox rows older than 90 days.
 */
#[AsCommand(name: 'app:shops:pull', description: 'Pulls the shops\' new orders (every active connection; --if-due: the ones due)')]
final class PullShopsCommand
{
    public function __invoke(
        SymfonyStyle $io,
        #[Option('Only the connections due (15 minutes after their last pull).')] bool $ifDue = false,
    ): int {
        if ($io->isVerbose()) {
            $io->writeln('Nothing to pull yet.');
        }

        return Command::SUCCESS;
    }
}
