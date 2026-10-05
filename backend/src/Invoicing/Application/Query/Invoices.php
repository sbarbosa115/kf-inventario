<?php

namespace App\Invoicing\Application\Query;

use App\Invoicing\Domain\Error\InvoiceNotFound;
use App\Invoicing\Domain\Model\Invoice;
use App\Invoicing\Domain\Repository\InvoiceRepository;
use App\Shared\Domain\Clock;

/**
 * What the invoice screens read.
 */
final class Invoices
{
    public function __construct(
        private readonly InvoiceRepository $invoices,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Every invoice, newest first.
     *
     * @return list<Invoice>
     */
    public function all(): array
    {
        return $this->invoices->all();
    }

    /**
     * @throws InvoiceNotFound
     */
    public function get(int $id): Invoice
    {
        return $this->invoices->get($id);
    }

    /**
     * The code the next invoice is offered: the newest invoice's code with its trailing number plus one (keeping its
     * prefix and its zero padding: INV-0001 → INV-0002), "-1" appended to a code with no number (X → X-1), and the
     * year and 0001 (20260001) when there is no invoice yet.
     */
    public function nextCode(): string
    {
        $latest = $this->invoices->findLatest()?->getCode();
        if (null === $latest || '' === $latest) {
            return $this->clock->now()->format('Y').'0001';
        }

        if (1 === preg_match('/^(.*?)(\d+)$/', $latest, $matches)) {
            return $matches[1].str_pad((string) ((int) $matches[2] + 1), \strlen($matches[2]), '0', \STR_PAD_LEFT);
        }

        return $latest.'-1';
    }
}
