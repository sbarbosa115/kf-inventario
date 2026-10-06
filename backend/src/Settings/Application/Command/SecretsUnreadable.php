<?php

namespace App\Settings\Application\Command;

/** Stored secrets neither the old nor the current key opens: the rekey changes nothing. Names them, never their values. */
final class SecretsUnreadable extends \RuntimeException
{
    /**
     * @param list<string> $refs
     */
    public function __construct(public readonly array $refs)
    {
        parent::__construct('Neither key opens: '.implode(', ', $refs).'.');
    }
}
