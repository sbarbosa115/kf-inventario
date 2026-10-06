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
     * The newest invoice (by creation date, the last one saved first on a tie), from which the next code is suggested.
     */
    public function findLatest(): ?Invoice;

    /**
     * Every invoice, newest first, with its customer, lines and the products of its lines.
     *
     * @return list<Invoice>
     */
    public function all(): array;

    public function add(Invoice $invoice): void;

    /**
     * Writes the new invoice now, inside the command's transaction, so it has its id (the table's auto-increment key)
     * for the answer. Rolled back with the command if it fails.
     */
    public function identify(Invoice $invoice): int;
}
