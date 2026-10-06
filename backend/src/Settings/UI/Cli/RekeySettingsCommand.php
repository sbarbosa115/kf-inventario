<?php

namespace App\Settings\UI\Cli;

use App\Settings\Application\Command\RekeyedSecrets;
use App\Settings\Application\Command\RekeySecrets;
use App\Settings\Application\Command\SecretsUnreadable;
use App\Shared\Application\Command\CommandBus;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Rotating APP_ENCRYPTION_KEY (docs/pdr/prd-shops-settings.md, Security): put the new key in backend/.env.local, then
 * run this with the previous one. Every stored secret (SMTP server, shop REST keys, webhook secrets) is re-sealed with
 * the new key; nothing changes when one cannot be opened. Never prints a secret.
 */
#[AsCommand(name: 'app:settings:rekey', description: 'Re-seal the stored secrets with the current APP_ENCRYPTION_KEY')]
final class RekeySettingsCommand extends Command
{
    public function __construct(private readonly CommandBus $commands)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('old-key', null, InputOption::VALUE_REQUIRED, 'The previous APP_ENCRYPTION_KEY (64 hex characters)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $oldKey = trim((string) $input->getOption('old-key'));
        if (1 !== preg_match('/^[0-9a-fA-F]{64}$/', $oldKey)) {
            $io->error('--old-key must be the previous APP_ENCRYPTION_KEY: 64 hex characters.');

            return Command::INVALID;
        }

        try {
            /** @var RekeyedSecrets $done */
            $done = $this->commands->dispatch(new RekeySecrets($oldKey));
        } catch (SecretsUnreadable $e) {
            $io->error(['Nothing was changed: neither key opens these secrets.', ...$e->refs]);

            return Command::FAILURE;
        }

        $io->success(\sprintf('%d secret(s) re-sealed, %d already sealed with the current key.', $done->resealed, $done->alreadyCurrent));

        return Command::SUCCESS;
    }
}
