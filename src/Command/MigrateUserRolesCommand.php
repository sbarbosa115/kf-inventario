<?php

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:migrate-user-roles', description: 'Convert PHP-serialized JSON columns to valid JSON')]
class MigrateUserRolesCommand extends Command
{
    private const COLUMNS = [
        ['table' => '`user`',      'column' => 'roles'],
        ['table' => 'warehouse',   'column' => 'urls'],
    ];

    public function __construct(private Connection $connection)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $totalUpdated = 0;

        foreach (self::COLUMNS as ['table' => $table, 'column' => $column]) {
            $io->section("Table {$table}, column {$column}");
            $rows = $this->connection->fetchAllAssociative("SELECT id, {$column} FROM {$table}");

            foreach ($rows as $row) {
                $raw = $row[$column];

                json_decode($raw);
                if (json_last_error() === JSON_ERROR_NONE) {
                    continue;
                }

                $unserialized = @unserialize($raw);
                if ($unserialized === false) {
                    $io->warning("id={$row['id']}: cannot unserialize '{$raw}' — skipping");
                    continue;
                }

                $json = json_encode(array_values((array) $unserialized));
                $this->connection->executeStatement(
                    "UPDATE {$table} SET {$column} = ? WHERE id = ?",
                    [$json, $row['id']]
                );
                $io->text("id={$row['id']}: '{$raw}' → '{$json}'");
                $totalUpdated++;
            }
        }

        $io->success("Done. {$totalUpdated} row(s) updated.");
        return Command::SUCCESS;
    }
}
