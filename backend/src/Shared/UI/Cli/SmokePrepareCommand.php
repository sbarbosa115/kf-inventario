<?php

namespace App\Shared\UI\Cli;

use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\KernelInterface;

/**
 * php bin/console app:smoke:prepare [--seed]: what e2e/prepare.sh needs from the app before a smoke run, in one boot
 * of Symfony instead of one per step. With --seed, the data: the dev fixtures (src/DataFixtures: warehouses, products,
 * customers, orders, invoices and the users of docs/tests/ui-regression.md), loaded over an emptied database. The
 * steps are the app's own commands, run in this process. Never in production.
 */
#[AsCommand(name: 'app:smoke:prepare', description: 'Prepares this stack for a smoke run: the dev fixtures (--seed)')]
final class SmokePrepareCommand
{
    public function __construct(
        private readonly KernelInterface $kernel,
        private readonly ManagerRegistry $doctrine,
        #[Autowire('%kernel.environment%')] private readonly string $environment,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option('Empty the database and load the dev fixtures.')] bool $seed = false,
    ): int {
        if ('prod' === $this->environment) {
            $io->error('app:smoke:prepare is for development stacks only.');

            return Command::FAILURE;
        }

        $application = new Application($this->kernel);
        $application->setAutoExit(false);
        foreach ($this->steps($seed) as $step) {
            $output = new BufferedOutput();
            $code = $application->run(new ArrayInput($step + ['--no-interaction' => true]), $output);
            // Each step starts as its own process started: nothing held from the one before.
            $this->doctrine->getManager()->clear();
            if (Command::SUCCESS !== $code) {
                $io->error(\sprintf('%s failed (%d):', $step['command'], $code));
                $io->writeln($output->fetch());

                return Command::FAILURE;
            }
            $io->writeln('· '.implode(' ', array_map(static fn ($value) => \is_array($value) ? implode(' ', $value) : (string) $value, $step)));
        }

        return Command::SUCCESS;
    }

    /**
     * @return list<array{command: string, pools?: list<string>}>
     */
    private function steps(bool $seed): array
    {
        $steps = [];
        if ($seed) {
            $steps[] = ['command' => 'doctrine:fixtures:load'];
        }
        $steps[] = ['command' => 'cache:pool:clear', 'pools' => ['cache.app']];

        return $steps;
    }
}
