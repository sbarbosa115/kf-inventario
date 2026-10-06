<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\UI\Http\Output\OrderCommentOutput;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * An order's comment timeline (docs/pdr/prd-shops-settings.md, "API changes" › Comments): read, add (typed, a quick
 * phrase, also sent to the shop), pin. PUT /orders/{id}/comments stays in OrderController for the order form. Item 7
 * (comments-api) builds these; 501 until then. Body of POST: Input\AddOrderCommentInput.
 */
final class OrderCommentController extends AbstractController
{
    /**
     * The order's comments, oldest first; a legacy comment without a date carries the order's (`approximate`).
     */
    #[Route('/api/v1/orders/{id}/comments', name: 'api_order_comments', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    #[ApiResponse(OrderCommentOutput::class, list: true, key: 'comments')]
    public function list(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * AddOrderCommentInput → 201 the comment (signed by you, dated now). 422 shop_note_unavailable when it cannot be
     * sent to the shop (the order is not linked, or the connection's order_note capability is off).
     */
    #[Route('/api/v1/orders/{id}/comments', name: 'api_order_comments_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class, status: 201)]
    public function add(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Pins the comment (the order's only pinned one: the previous one is unpinned). 404 comment_not_found.
     */
    #[Route('/api/v1/orders/{id}/comments/{commentId}/pin', name: 'api_order_comments_pin', methods: ['POST'], requirements: ['id' => '\d+', 'commentId' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class)]
    public function pin(int $id, int $commentId): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Unpins it. 404 comment_not_found.
     */
    #[Route('/api/v1/orders/{id}/comments/{commentId}/pin', name: 'api_order_comments_unpin', methods: ['DELETE'], requirements: ['id' => '\d+', 'commentId' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class)]
    public function unpin(int $id, int $commentId): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
