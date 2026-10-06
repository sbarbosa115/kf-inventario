<?php

namespace App\Settings\Application\Command;

/** What RekeySecrets did: re-sealed with the current key, or found already sealed with it (a second run). */
final readonly class RekeyedSecrets
{
    public function __construct(
        public int $resealed,
        public int $alreadyCurrent,
    ) {
    }
}
