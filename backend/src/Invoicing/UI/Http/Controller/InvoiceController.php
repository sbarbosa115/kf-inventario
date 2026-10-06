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
use App\Shared\Application\Query\ListField;
use App\Shared\Application\Query\ListSchema;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InMemoryList;
use App\Shared\UI\Http\InputMapper;
use App\Shared\UI\Http\ListQueryParser;
use App\Shared\UI\Http\Output\PageOutput;
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
        private readonly ListQueryParser $lists,
    ) {
    }

    /** The invoices list's contract (docs/pdr/prd-shops-settings.md, "List query contract"). */
    public static function listSchema(): ListSchema
    {
        return new ListSchema(
            fields: [
                'code' => ListField::text(),
                'customer' => ListField::text(),
                'payment_method' => ListField::enumMatching('/^.{1,64}$/u'),
                'created_at' => ListField::date(),
                'total' => ListField::number(),
                'walk_in' => ListField::enum(['yes', 'no']),
            ],
            sorts: ['code', 'customer', 'created_at', 'total'],
            defaultSort: '-created_at',
        );
    }

    /**
     * A page of invoices, newest first: the list contract (q over code, customer name and email; filters code,
     * customer, payment_method[], created_at, total, walk_in[] yes/no; sorts code, customer, created_at, total).
     */
    #[Route('/api/v1/invoices', name: 'api_invoices_list', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    #[ApiResponse(InvoiceOutput::class, page: true)]
    public function list(Request $request): JsonResponse
    {
        $query = $this->lists->parse($request, self::listSchema());

        // Item 0's walking skeleton: filtered in memory; item 1 (list-api) moves it into SQL.
        $customer = static fn (InvoiceOutput $i): string => null === $i->customer ? '' : trim(($i->customer->firstName ?? '').' '.($i->customer->lastName ?? ''));
        $created = static fn (InvoiceOutput $i): ?\DateTimeImmutable => null === $i->createdAt ? null : new \DateTimeImmutable($i->createdAt);
        $page = InMemoryList::page(
            array_map($this->presenter->invoice(...), $this->invoices->all()),
            $query,
            [
                'code' => static fn (InvoiceOutput $i) => $i->code,
                'customer' => static fn (InvoiceOutput $i) => trim($customer($i).' '.($i->customer->email ?? '')),
                'payment_method' => static fn (InvoiceOutput $i) => $i->paymentMethod,
                'created_at' => $created,
                'total' => static fn (InvoiceOutput $i) => $i->total,
                'walk_in' => static fn (InvoiceOutput $i) => null === $i->customer ? 'yes' : 'no',
            ],
            [static fn (InvoiceOutput $i) => $i->code, $customer, static fn (InvoiceOutput $i) => $i->customer?->email],
            static fn (InvoiceOutput $i) => $i->id,
        );

        return $this->json(PageOutput::of($page, $query, static fn (InvoiceOutput $i) => $i));
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
