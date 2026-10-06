<?php

namespace App\Settings\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class QuickPhraseNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('quick_phrase_not_found', 'Quick phrase not found.');
    }
}
