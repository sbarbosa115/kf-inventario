<?php

namespace App\Settings\Infrastructure\Crypto;

use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Port\SecretBoxFactory;

final class SodiumSecretBoxFactory implements SecretBoxFactory
{
    public function withKey(string $hexKey): SecretBox
    {
        return new SodiumSecretBox($hexKey);
    }
}
