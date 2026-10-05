<?php

namespace App\Tests\Functional\Identity;

/**
 * Records whether unserialize() built it (MigrateJsonColumnsCommandTest).
 */
final class WakeUpSpy
{
    public static bool $wokenUp = false;

    /**
     * @param array<mixed> $data
     */
    public function __unserialize(array $data): void
    {
        self::$wokenUp = true;
    }
}
