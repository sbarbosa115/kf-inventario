<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

/** A comment posted as a quick phrase that is not one of the active phrases (Settings › Quick phrases). */
final class CommentPhraseNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('quick_phrase_not_found', 'Quick phrase not found.');
    }
}
