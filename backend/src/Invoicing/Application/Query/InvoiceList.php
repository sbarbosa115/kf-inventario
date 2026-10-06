<?php

namespace App\Invoicing\Application\Query;

use App\Invoicing\Domain\Model\Invoice;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * The invoices list in the database (docs/pdr/prd-shops-settings.md, "List query contract"): filtered, sorted and
 * paged by the query, with the facet counts it asks for.
 */
interface InvoiceList
{
    /**
     * Each invoice with its customer and lines (and their products) loaded.
     *
     * @return ListPage<Invoice>
     */
    public function page(ListQuery $query): ListPage;
}
