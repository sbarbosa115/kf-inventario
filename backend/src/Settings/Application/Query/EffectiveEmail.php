<?php

namespace App\Settings\Application\Query;

/**
 * What the order email and the mailer use right now: each value from Settings when it holds one, else from env, else
 * empty — and where each came from ('settings', 'env' or 'none'), which the Email tab shows (Decisions 3).
 */
final readonly class EffectiveEmail
{
    public const SOURCE_SETTINGS = 'settings';
    public const SOURCE_ENV = 'env';
    public const SOURCE_NONE = 'none';

    /**
     * @param list<string>                                                  $cc
     * @param array{dsn: string, from: string, printer: string, cc: string} $sources
     */
    public function __construct(
        public ?string $dsn,
        public string $fromAddress,
        public string $fromName,
        public string $printerAddress,
        public array $cc,
        public array $sources,
    ) {
    }
}
