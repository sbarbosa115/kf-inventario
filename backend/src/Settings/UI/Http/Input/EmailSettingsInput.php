<?php

namespace App\Settings\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/** Settings › Email. A blank password keeps the saved one; every field empty clears the settings (env applies). */
final class EmailSettingsInput
{
    #[Assert\Length(max: 255)]
    public ?string $host = null;

    #[Assert\Range(min: 1, max: 65535)]
    public ?int $port = null;

    #[Assert\Length(max: 255)]
    public ?string $user = null;

    #[Assert\Length(max: 255)]
    public ?string $password = null;

    #[Assert\Choice(choices: ['tls', 'ssl', 'none'])]
    public string $encryption = 'tls';

    #[Assert\Email]
    #[Assert\Length(max: 255)]
    public ?string $fromAddress = null;

    #[Assert\Length(max: 255)]
    public ?string $fromName = null;

    #[Assert\Email]
    #[Assert\Length(max: 255)]
    public ?string $printerAddress = null;

    /** @var list<string> */
    #[Assert\All([new Assert\Email(), new Assert\Length(max: 255)])]
    public array $cc = [];
}
