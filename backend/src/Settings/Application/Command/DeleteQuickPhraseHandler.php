<?php

namespace App\Settings\Application\Command;

use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\Domain\Repository\QuickPhraseRepository;
use App\Shared\Application\Command\CommandHandler;

final class DeleteQuickPhraseHandler implements CommandHandler
{
    public function __construct(private readonly QuickPhraseRepository $phrases)
    {
    }

    /**
     * @throws QuickPhraseNotFound
     */
    public function __invoke(DeleteQuickPhrase $command): void
    {
        $this->phrases->remove($this->phrases->get($command->id));
    }
}
