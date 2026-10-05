<?php

namespace App\Invoicing\UI\Http\Controller;

use App\Invoicing\UI\Http\Output\InvoiceOutput;
use App\Invoicing\UI\Http\Output\NextInvoiceCodeOutput;
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
final class InvoiceController extends AbstractController
{
    /**
     * Every invoice, newest first. (item 5).
     */
    #[Route('/api/v1/invoices', name: 'api_invoices_list', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    #[ApiResponse(InvoiceOutput::class, list: true)]
    public function list(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * The code the next invoice is offered. (item 5).
     */
    #[Route('/api/v1/invoices/next-code', name: 'api_invoices_next_code', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_CREATE_INVOICES')]
    #[ApiResponse(NextInvoiceCodeOutput::class)]
    public function nextCode(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * One invoice. 404 invoice_not_found. (item 5).
     */
    #[Route('/api/v1/invoices/{id}', name: 'api_invoices_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    #[ApiResponse(InvoiceOutput::class)]
    public function show(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * InvoiceInput: creates an invoice. 409 invoice_code_taken. (item 5).
     */
    #[Route('/api/v1/invoices', name: 'api_invoices_create', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_CREATE_INVOICES')]
    #[ApiResponse(InvoiceOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
