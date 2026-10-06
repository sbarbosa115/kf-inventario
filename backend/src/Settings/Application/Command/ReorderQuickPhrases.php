<?php

namespace App\Settings\Application\Command;

/** The phrases' new order: these ids first, in this order; the others keep theirs after them. */
final readonly class ReorderQuickPhrases
{
    /**
     * @param list<int> $ids
     */
    public function __construct(public array $ids)
    {
    }
}
