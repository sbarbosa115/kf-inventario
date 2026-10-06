<?php

namespace App\Settings\UI\Http\Controller;

use App\Settings\UI\Http\Output\QuickPhraseOutput;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The quick phrases of the comment box (docs/pdr/prd-shops-settings.md, "API changes" › Settings): read by anyone
 * signed in (the comment box), edited by an admin. Item 3 (settings-api) builds them; 501 until then.
 */
final class QuickPhraseController extends AbstractController
{
    /**
     * The active phrases in order (`?all=1`: every one, for the admin's tab).
     */
    #[Route('/api/v1/settings/quick-phrases', name: 'api_quick_phrases', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(QuickPhraseOutput::class, list: true)]
    public function list(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * QuickPhraseInput: a phrase at the end → 201.
     */
    #[Route('/api/v1/settings/quick-phrases', name: 'api_quick_phrases_create', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(QuickPhraseOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * QuickPhraseOrderInput: the phrases' new order → the list.
     */
    #[Route('/api/v1/settings/quick-phrases/order', name: 'api_quick_phrases_order', methods: ['PUT'], priority: 1)]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(QuickPhraseOutput::class, list: true)]
    public function reorder(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * QuickPhraseInput: renames it or switches it off. 404 quick_phrase_not_found.
     */
    #[Route('/api/v1/settings/quick-phrases/{id}', name: 'api_quick_phrases_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(QuickPhraseOutput::class)]
    public function update(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * 204. 404 quick_phrase_not_found.
     */
    #[Route('/api/v1/settings/quick-phrases/{id}', name: 'api_quick_phrases_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_ADMIN')]
    public function delete(int $id): Response
    {
        throw ApiException::notImplemented();
    }
}
