<?php

namespace App\Settings\Application\Command;

final readonly class DeleteQuickPhrase
{
    public function __construct(public int $id)
    {
    }
}
