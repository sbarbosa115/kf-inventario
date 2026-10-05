<?php

namespace App\Invoicing\UI\Http\Controller;

use App\Customers\Application\Command\SaveCustomer;
use App\Invoicing\Application\Command\CreateInvoice;
use App\Invoicing\Application\Command\InvoiceLine;
use App\Invoicing\Application\Query\Invoices;
use App\Invoicing\UI\Http\Input\InvoiceInput;
use App\Invoicing\UI\Http\Input\InvoiceItemInput;
use App\Invoicing\UI\Http\InvoicePresenter;
use App\Invoicing\UI\Http\Output\InvoiceOutput;
use App\Invoicing\UI\Http\Output\NextInvoiceCodeOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Invoices: the list, the detail, the code offered for the next one, and creating one.
 */
final class InvoiceController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly Invoices $invoices,
        private readonly InputMapper $inputs,
        private readonly InvoicePresenter $presenter,
    ) {
    }

    /**
     * Every invoice, newest first.
     */
    #[Route('/api/v1/invoices', name: 'api_invoices_list', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    #[ApiResponse(InvoiceOutput::class, list: true)]
    public function list(): JsonResponse
    {
        return $this->json(array_map($this->presenter->invoice(...), $this->invoices->all()));
    }

    /**
     * The code the next invoice is offered: the newest invoice's code plus one, or the year and 0001 for the first.
     */
    #[Route('/api/v1/invoices/next-code', name: 'api_invoices_next_code', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_CREATE_INVOICES')]
    #[ApiResponse(NextInvoiceCodeOutput::class)]
    public function nextCode(): JsonResponse
    {
        return $this->json(new NextInvoiceCodeOutput($this->invoices->nextCode()));
    }

    /**
     * One invoice. 404 invoice_not_found.
     */
    #[Route('/api/v1/invoices/{id}', name: 'api_invoices_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    #[ApiResponse(InvoiceOutput::class)]
    public function show(int $id): JsonResponse
    {
        return $this->json($this->presenter->invoice($this->invoices->get($id)));
    }

    /**
     * InvoiceInput: creates an invoice (the customer is `customer_id`, or found by id, email or phone and updated, or
     * created from `customer`; with no address typed, the customer's first one is copied). 409 invoice_code_taken.
     */
    #[Route('/api/v1/invoices', name: 'api_invoices_create', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_CREATE_INVOICES')]
    #[ApiResponse(InvoiceOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), InvoiceInput::class);

        $id = $this->commands->dispatch(new CreateInvoice(
            code: $input->code,
            paymentMethod: $input->paymentMethod,
            customerId: $input->customerId,
            customer: self::customer($input),
            customerAddress: $input->customerAddress,
            taxRate: $input->taxRate,
            comment: $input->comment,
            lines: array_map(static fn (InvoiceItemInput $line) => new InvoiceLine($line->productId, $line->description, $line->quantity, $line->unitPrice, $line->discount), $input->items),
        ));

        return $this->json($this->presenter->invoice($this->invoices->get($id)), 201);
    }

    /**
     * The customer typed on the invoice, if anything was typed: an empty `customer` object names nobody (as before).
     */
    private static function customer(InvoiceInput $input): ?SaveCustomer
    {
        $customer = $input->customer;
        if (null === $customer) {
            return null;
        }
        $id = $customer->id ?? $input->customerId;
        if (null === $id && null === $customer->firstName && null === $customer->lastName && null === $customer->email && null === $customer->phone && [] === $customer->addresses) {
            return null;
        }

        return $customer->toCommand($id);
    }
}
