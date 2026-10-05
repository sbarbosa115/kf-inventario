<?php

namespace App\Inventory\Domain\Error;

use App\Shared\Domain\Error\UnsupportedMedia;

/**
 * An upload that is not an xls/xlsx spreadsheet, by its content (the legacy UploadProductsType's MIME list).
 */
final class UnsupportedSpreadsheet extends UnsupportedMedia
{
    public function __construct()
    {
        parent::__construct('unsupported_media', 'Upload an xls or xlsx spreadsheet.');
    }
}
