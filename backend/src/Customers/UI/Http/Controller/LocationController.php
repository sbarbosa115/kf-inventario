<?php

namespace App\Customers\UI\Http\Controller;

use App\Customers\Application\Query\Locations;
use App\Customers\UI\Http\Output\CountryOutput;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

final class LocationController extends AbstractController
{
    /**
     * Every country with its states and their cities, all of them, by id.
     */
    #[Route('/api/v1/locations', name: 'api_locations_tree', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(CountryOutput::class, list: true)]
    public function tree(Locations $locations): JsonResponse
    {
        return $this->json(array_map(CountryOutput::of(...), $locations->tree()));
    }
}
