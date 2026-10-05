<?php

namespace App\Controller;

use App\Repository\WarehouseRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/warehouse', name: 'warehouse_')]
class WarehouseController extends AbstractController
{
    #[Route('/all', name: 'all', methods: ['GET'], options: ['expose' => true])]
    public function all(WarehouseRepository $warehouseRepo): JsonResponse
    {
        $warehouses = $warehouseRepo->findAllAsArray();

        return new JsonResponse($warehouses);
    }
}
