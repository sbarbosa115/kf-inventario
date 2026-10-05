<?php

namespace App\Inventory\UI\Http\Controller;

use App\Inventory\Application\Command\RenameWarehouse;
use App\Inventory\Application\Query\Warehouses;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\UI\Http\Input\WarehouseInput;
use App\Inventory\UI\Http\Output\WarehouseOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The warehouses (the legacy /admin/warehouse pages: any signed-in user).
 */
final class WarehouseController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $bus,
        private readonly InputMapper $inputs,
        private readonly Warehouses $warehouses,
    ) {
    }

    /**
     * Every warehouse, by id (as /admin/warehouse/all: any signed-in user).
     */
    #[Route('/api/v1/warehouses', name: 'api_warehouses_list', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(WarehouseOutput::class, list: true)]
    public function list(): JsonResponse
    {
        return $this->json(array_map(self::output(...), $this->warehouses->all()));
    }

    /**
     * WarehouseInput: renames a warehouse (as the legacy edit: any signed-in user). 404 warehouse_not_found.
     */
    #[Route('/api/v1/warehouses/{id}', name: 'api_warehouses_rename', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(WarehouseOutput::class)]
    public function rename(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), WarehouseInput::class);

        $this->bus->dispatch(new RenameWarehouse($id, trim($input->name)));

        return $this->json(self::output($this->warehouses->get($id)));
    }

    private static function output(Warehouse $warehouse): WarehouseOutput
    {
        return new WarehouseOutput((int) $warehouse->getId(), (string) $warehouse->getName(), array_values($warehouse->getUrls()));
    }
}
