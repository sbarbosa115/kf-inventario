<?php

namespace App\Settings\Application\Command;

use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\Domain\Repository\QuickPhraseRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

final class DeleteQuickPhraseHandler implements CommandHandler
{
    public function __construct(
        private readonly QuickPhraseRepository $phrases,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @throws QuickPhraseNotFound
     */
    public function __invoke(DeleteQuickPhrase $command): void
    {
        $this->phrases->remove($this->phrases->get($command->id));
        $this->activity->record('Settings', 'A quick phrase was deleted.', ['entity' => 'quick_phrase', 'id' => $command->id]);
    }
}
