<?php

namespace App\Inventory\Infrastructure\Persistence;

use App\Inventory\Domain\Error\WarehouseNotFound;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\Domain\Repository\WarehouseRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineWarehouseRepository implements WarehouseRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): Warehouse
    {
        return $this->em->find(Warehouse::class, $id) ?? throw new WarehouseNotFound();
    }

    public function all(): array
    {
        /** @var list<Warehouse> $warehouses */
        $warehouses = $this->em->getRepository(Warehouse::class)->findBy([], ['id' => 'ASC']);

        return $warehouses;
    }
}
