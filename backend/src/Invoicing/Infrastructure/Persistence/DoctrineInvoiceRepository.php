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
        return $this->em->getRepository(Invoice::class)->findOneBy([], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }

    public function all(): array
    {
        /** @var list<Invoice> $invoices */
        $invoices = $this->em->createQueryBuilder()
            ->select('i', 'c', 'it', 'p')
            ->from(Invoice::class, 'i')
            ->leftJoin('i.customer', 'c')
            ->leftJoin('i.items', 'it')
            ->leftJoin('it.product', 'p')
            ->orderBy('i.createdAt', 'DESC')
            ->addOrderBy('i.id', 'DESC')
            ->addOrderBy('it.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $invoices;
    }

    public function add(Invoice $invoice): void
    {
        $this->em->persist($invoice);
    }

    public function identify(Invoice $invoice): int
    {
        $this->em->persist($invoice);
        $this->em->flush();

        return (int) $invoice->getId();
    }
}
