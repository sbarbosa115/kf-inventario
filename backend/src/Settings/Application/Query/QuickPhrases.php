<?php

namespace App\Settings\Application\Query;

use App\Settings\Domain\Model\QuickPhrase;
use App\Settings\Domain\Repository\QuickPhraseRepository;

/** The comment box's phrase bar (active ones, in order) and the Quick phrases tab (all of them). */
final class QuickPhrases
{
    public function __construct(private readonly QuickPhraseRepository $phrases)
    {
    }

    /**
     * @return list<QuickPhraseView>
     */
    public function list(bool $includeInactive = false): array
    {
        return array_map(
            static fn (QuickPhrase $p) => new QuickPhraseView((int) $p->id(), $p->text(), $p->position(), $p->isActive()),
            $this->phrases->ordered(!$includeInactive),
        );
    }
}
