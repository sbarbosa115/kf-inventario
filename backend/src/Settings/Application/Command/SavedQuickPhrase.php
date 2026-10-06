<?php

namespace App\Settings\Application\Command;

use App\Settings\Domain\Model\QuickPhrase;

/**
 * What SaveQuickPhrase answers. A new phrase's id is assigned when the bus commits (handlers never flush), so it is
 * read from here once dispatch() has returned.
 */
final class SavedQuickPhrase
{
    public function __construct(private readonly QuickPhrase $phrase)
    {
    }

    public function id(): int
    {
        return (int) $this->phrase->id();
    }
}
