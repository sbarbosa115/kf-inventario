<?php

namespace App\Settings\Application\Port;

/**
 * Secrets another context seals with SecretBox in its own tables (Ordering's shop connections: REST keys and webhook
 * secrets), so app:settings:rekey re-seals them with the settings' own. Implemented by that context.
 */
interface ForeignSealedSecrets
{
    /**
     * @return array<string, string> a reference to each sealed value ("shop_connection.3.consumer_key") => the value
     */
    public function sealed(): array;

    /** Writes a value re-sealed with the current key back where `$ref` says. */
    public function replace(string $ref, string $sealed): void;
}
