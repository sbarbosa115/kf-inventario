<?php

namespace App\Invoicing\Infrastructure\Persistence;

use App\Invoicing\Domain\Error\InvoiceNotFound;
use App\Invoicing\Domain\Model\Invoice;
use App\Invoicing\Domain\Repository\InvoiceRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineInvoiceRepository implements InvoiceRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): Invoice
    {
        return $this->em->find(Invoice::class, $id) ?? throw new InvoiceNotFound();
    }

    public function findByCode(string $code): ?Invoice
    {
        return $this->em->getRepository(Invoice::class)->findOneBy(['code' => $code]);
    }

    public function findLatest(): ?Invoice
    {
        return $this->em->getRepository(Invoice::class)->findOneBy([], ['createdAt' => 'DESC']);
    }

    public function add(Invoice $invoice): void
    {
        $this->em->persist($invoice);
    }
}
