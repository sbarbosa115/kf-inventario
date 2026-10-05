<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Application\Port\ImportedOrderCodes;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Plain SQL on purpose: the soft-delete filter (Gedmo) hides deleted orders from every ORM query, and a deleted order
 * still counts as imported.
 */
final class DoctrineImportedOrderCodes implements ImportedOrderCodes
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function of(int $warehouseId): array
    {
        /** @var list<string> $codes */
        $codes = $this->em->getConnection()->fetchFirstColumn(
            'SELECT code FROM `order` WHERE warehouse_id = ? AND code IS NOT NULL',
            [$warehouseId],
        );

        return $codes;
    }
}
