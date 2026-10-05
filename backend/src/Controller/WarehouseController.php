<?php

namespace App\Controller;

use App\Entity\Warehouse;
use App\Form\WarehouseType;
use App\Repository\WarehouseRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/warehouse', name: 'warehouse_')]
class WarehouseController extends AbstractController
{
    #[Route('/', name: 'warehouse_index')]
    public function index(WarehouseRepository $warehouseRepo): Response
    {
        $warehouses = $warehouseRepo->findAll();

        return $this->render('warehouse/index.html.twig', [
            'warehouses' => $warehouses,
        ]);
    }

    #[Route('/edit/{warehouse}', name: 'warehouse_edit', methods: ['POST', 'GET'])]
    public function edit(Request $request, Warehouse $warehouse, EntityManagerInterface $em): Response
    {
        $form = $this->createForm(WarehouseType::class, $warehouse);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', 'updated_successfully');

            return $this->redirectToRoute('warehouse_warehouse_index');
        }

        return $this->render('warehouse/edit.html.twig', [
            'form' => $form->createView(),
        ]);
    }

    #[Route('/all', name: 'all', methods: ['GET'], options: ['expose' => true])]
    public function all(WarehouseRepository $warehouseRepo): JsonResponse
    {
        $warehouses = $warehouseRepo->findAllAsArray();

        return new JsonResponse($warehouses);
    }
}
