<?php

namespace App\Settings\Domain\Repository;

use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\Domain\Model\QuickPhrase;

interface QuickPhraseRepository
{
    /**
     * @throws QuickPhraseNotFound
     */
    public function get(int $id): QuickPhrase;

    public function add(QuickPhrase $phrase): void;

    public function remove(QuickPhrase $phrase): void;

    /**
     * @return list<QuickPhrase> by position, then id; the inactive ones too unless $activeOnly
     */
    public function ordered(bool $activeOnly): array;

    /** The position after the last phrase (0 for the first). */
    public function nextPosition(): int;
}
