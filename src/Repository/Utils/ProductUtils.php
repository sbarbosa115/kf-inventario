<?php

namespace App\Repository\Utils;

use InvalidArgumentException;

class ProductUtils
{
    public static function builtQueryByUuidOrCode(array $rowData): array
    {
        if (\array_key_exists('uuid', $rowData)) {
            return ['uuid' => $rowData['uuid']];
        }
        if (\array_key_exists('code', $rowData)) {
            return ['code' => $rowData['code']];
        }

        throw new InvalidArgumentException('No one query filter, Code or Uuid was defined.');
    }
}
