<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\InvalidValue;

/**
 * A connection moved to another site (scheme, host or port) with a blank consumer key or secret: the saved keys are
 * kept only for the site they were typed for, so they never go to a host nobody typed them for (security audit
 * 2026-10-06, finding 1). 422 on consumer_key.
 */
final class ShopKeysRequired extends InvalidValue
{
    public const MESSAGE = 'Type the consumer key and secret again: the saved ones are only sent to the site they were saved for.';

    public function __construct()
    {
        parent::__construct('consumer_key', self::MESSAGE);
    }
}
