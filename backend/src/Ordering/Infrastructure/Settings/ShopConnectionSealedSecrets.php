<?php

namespace App\Ordering\Infrastructure\Settings;

use App\Settings\Application\Port\ForeignSealedSecrets;
use Doctrine\DBAL\Connection;

/**
 * The shop connections' sealed REST keys and webhook secrets, for app:settings:rekey (Settings re-seals them with its
 * SecretBox). Plain SQL on the three columns: a rekey changes the ciphertext, not the connection, so nothing else of
 * the row (updated_at, health) moves.
 */
final class ShopConnectionSealedSecrets implements ForeignSealedSecrets
{
    private const COLUMNS = ['consumer_key', 'consumer_secret', 'webhook_secret'];

    public function __construct(private readonly Connection $db)
    {
    }

    public function sealed(): array
    {
        $sealed = [];
        foreach ($this->db->fetchAllAssociative('SELECT id, consumer_key, consumer_secret, webhook_secret FROM shop_connection ORDER BY id') as $row) {
            foreach (self::COLUMNS as $column) {
                if (\is_string($row[$column]) && '' !== $row[$column]) {
                    $sealed["shop_connection.{$row['id']}.{$column}"] = $row[$column];
                }
            }
        }

        return $sealed;
    }

    public function replace(string $ref, string $sealed): void
    {
        if (1 !== preg_match('/^shop_connection\.(\d+)\.(consumer_key|consumer_secret|webhook_secret)$/', $ref, $m)) {
            throw new \InvalidArgumentException(\sprintf('"%s" is not a shop connection secret.', $ref));
        }
        // The column comes from the allow-list of the pattern above, never from input.
        $this->db->executeStatement("UPDATE shop_connection SET {$m[2]} = ? WHERE id = ?", [$sealed, (int) $m[1]]);
    }
}
