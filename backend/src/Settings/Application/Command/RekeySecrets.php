<?php

namespace App\Settings\Application\Command;

/** Re-seals every stored secret with the current APP_ENCRYPTION_KEY; `$oldHexKey` opens what the previous one sealed. */
final readonly class RekeySecrets
{
    public function __construct(public string $oldHexKey)
    {
    }
}
