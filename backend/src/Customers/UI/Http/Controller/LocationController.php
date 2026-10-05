<?php

namespace App\Customers\UI\Http\Controller;

use App\Customers\UI\Http\Output\CountryOutput;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The contract of this context's endpoints (docs/pdr/prd-restructure.md, the route map): each answers 501
 * not_implemented until the item named on it builds it, test-first, keeping the route, its role and its response.
 */
final class LocationController extends AbstractController
{
    /**
     * Every country with its states and their cities. (item 3).
     */
    #[Route('/api/v1/locations', name: 'api_locations_tree', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(CountryOutput::class, list: true)]
    public function tree(): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
