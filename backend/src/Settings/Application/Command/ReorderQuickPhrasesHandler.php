<?php

namespace App\Settings\Application\Command;

use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\Domain\Model\QuickPhrase;
use App\Settings\Domain\Repository\QuickPhraseRepository;
use App\Shared\Application\Command\CommandHandler;

final class ReorderQuickPhrasesHandler implements CommandHandler
{
    public function __construct(private readonly QuickPhraseRepository $phrases)
    {
    }

    /**
     * @throws QuickPhraseNotFound an id that is not a phrase
     */
    public function __invoke(ReorderQuickPhrases $command): void
    {
        $listed = array_map(fn (int $id): QuickPhrase => $this->phrases->get($id), array_values(array_unique($command->ids)));
        $rest = array_filter($this->phrases->ordered(false), static fn (QuickPhrase $p): bool => !\in_array($p->id(), $command->ids, true));
        foreach ([...$listed, ...$rest] as $position => $phrase) {
            $phrase->moveTo($position);
        }
    }
}
