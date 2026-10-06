<?php

namespace App\Settings\Application\Command;

use App\Settings\Domain\Error\InvalidSetting;
use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\Domain\Model\QuickPhrase;
use App\Settings\Domain\Repository\QuickPhraseRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

final class SaveQuickPhraseHandler implements CommandHandler
{
    public function __construct(
        private readonly QuickPhraseRepository $phrases,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @throws QuickPhraseNotFound
     */
    public function __invoke(SaveQuickPhrase $command): SavedQuickPhrase
    {
        $text = trim($command->text);
        if ('' === $text || mb_strlen($text) > QuickPhrase::MAX_LENGTH) {
            throw new InvalidSetting('text', 'A phrase has 1 to 255 characters.');
        }
        if (null === $command->id) {
            $phrase = new QuickPhrase($text, $this->phrases->nextPosition(), $this->clock->now(), $command->active);
            $this->phrases->add($phrase);

            return new SavedQuickPhrase($phrase);
        }
        $phrase = $this->phrases->get($command->id);
        $phrase->rename($text);
        $phrase->activate($command->active);

        return new SavedQuickPhrase($phrase);
    }
}
