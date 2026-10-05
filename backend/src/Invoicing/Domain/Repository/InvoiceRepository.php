<?php

namespace App\Invoicing\Domain\Repository;

use App\Invoicing\Domain\Error\InvoiceNotFound;
use App\Invoicing\Domain\Model\Invoice;

interface InvoiceRepository
{
    /**
     * @throws InvoiceNotFound
     */
    public function get(int $id): Invoice;

    public function findByCode(string $code): ?Invoice;

    /**
     * The newest invoice (by creation date), from which the next code is suggested.
     */
    public function findLatest(): ?Invoice;

    public function add(Invoice $invoice): void;
}
