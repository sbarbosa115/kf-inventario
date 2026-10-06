<?php

namespace App\Settings\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

final class WebhookSettingsInput
{
    #[Assert\NotNull]
    public ?bool $legacyEnabled = null;
}
