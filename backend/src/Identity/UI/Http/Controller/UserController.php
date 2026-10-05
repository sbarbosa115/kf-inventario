<?php

namespace App\Identity\UI\Http\Controller;

use App\Identity\UI\Http\Output\UserOutput;
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
final class UserController extends AbstractController
{
    /**
     * Every user, by name. (item 1).
     */
    #[Route('/api/v1/users', name: 'api_users_list', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class, list: true)]
    public function list(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * One user. 404 user_not_found. (item 1).
     */
    #[Route('/api/v1/users/{id}', name: 'api_users_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class)]
    public function show(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * UserInput: creates a user. 422 when invalid. (item 1).
     */
    #[Route('/api/v1/users', name: 'api_users_create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * UserInput: edits a user; a blank password keeps the current one. (item 1).
     */
    #[Route('/api/v1/users/{id}', name: 'api_users_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class)]
    public function update(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
