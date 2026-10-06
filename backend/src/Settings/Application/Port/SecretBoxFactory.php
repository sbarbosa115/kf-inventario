<?php

namespace App\Settings\Application\Port;

/** A SecretBox on a key other than APP_ENCRYPTION_KEY: the previous key, to open what it sealed (app:settings:rekey). */
interface SecretBoxFactory
{
    /**
     * @param string $hexKey 64 hex characters (32 bytes)
     *
     * @throws \InvalidArgumentException not a key
     */
    public function withKey(string $hexKey): SecretBox;
}
