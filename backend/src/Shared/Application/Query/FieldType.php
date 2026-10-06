<?php

namespace App\Shared\Application\Query;

/** How a list column filters (docs/pdr/prd-shops-settings.md, "List query contract"). */
enum FieldType: string
{
    /** filter[f]=text: contains, case-insensitive, wildcards literal. */
    case Text = 'text';
    /** filter[f][]=v: any of these values; the only kind that has facets. */
    case Enum = 'enum';
    /** filter[f][from|to]=YYYY-MM-DD: Bogota days, both included. */
    case Date = 'date';
    /** filter[f][min|max]=decimal: both included (money, quantities, ids). */
    case Number = 'number';
}
