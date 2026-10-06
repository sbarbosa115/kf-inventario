<?php

namespace App\Settings\Domain\Error;

use App\Shared\Domain\Error\InvalidValue;

/** A setting value the app cannot use (an analytics id of the wrong shape, an unknown encryption…): 422 on its field. */
final class InvalidSetting extends InvalidValue
{
}
