<?php

namespace App\Customers\UI\Http\Controller;

use App\Customers\Application\Command\DeleteCustomer;
use App\Customers\Application\Query\Customers;
use App\Customers\UI\Http\Input\CustomerInput;
use App\Customers\UI\Http\Output\CustomerOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\Application\Query\ListField;
use App\Shared\Application\Query\ListSchema;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\ApiValidationException;
use App\Shared\UI\Http\InMemoryList;
use App\Shared\UI\Http\InputMapper;
use App\Shared\UI\Http\ListQueryParser;
use App\Shared\UI\Http\Output\PageOutput;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\ExpressionLanguage\Expression;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final class CustomerController extends AbstractController
{
    /** The legacy customers screen, and the order (new, edit) and new-invoice pages that embedded every customer. */
    private const PICKER_ROLES = "is_granted('ROLE_MANAGE_CUSTOMERS') or is_granted('ROLE_CAN_CREATE_ORDERS') or is_granted('ROLE_CAN_UPDATE_ORDERS') or is_granted('ROLE_CAN_CREATE_INVOICES')";

    public function __construct(
        private readonly Customers $customers,
        private readonly CommandBus $bus,
        private readonly InputMapper $inputs,
        private readonly ValidatorInterface $validator,
        private readonly ListQueryParser $lists,
    ) {
    }

    /** The customers list's contract (docs/pdr/prd-shops-settings.md, "List query contract"). */
    public static function listSchema(): ListSchema
    {
        return new ListSchema(
            fields: [
                'name' => ListField::text(),
                'email' => ListField::text(),
                'phone' => ListField::text(),
                'city' => ListField::text(),
                'country' => ListField::enumMatching('/^\d{1,9}$/'),
            ],
            sorts: ['name', 'email', 'city'],
            defaultSort: '-id',
        );
    }

    /**
     * A page of customers, newest first: the list contract (q over first/last name, email, phone and city; filters
     * name, email, phone, city, country[] (country ids, any address); sorts name, email, city).
     */
    #[Route('/api/v1/customers', name: 'api_customers_page', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class, page: true)]
    public function page(Request $request): JsonResponse
    {
        $query = $this->lists->parse($request, self::listSchema());

        // Item 0's walking skeleton: filtered in memory; item 1 (list-api) moves it into SQL.
        $name = static fn (CustomerOutput $c): string => trim(($c->firstName ?? '').' '.($c->lastName ?? ''));
        $city = static fn (CustomerOutput $c): ?string => ($c->addresses[0] ?? null)?->city?->name;
        $page = InMemoryList::page(
            array_map(CustomerOutput::of(...), $this->customers->all()),
            $query,
            [
                'id' => static fn (CustomerOutput $c) => $c->id,
                'name' => $name,
                'email' => static fn (CustomerOutput $c) => $c->email,
                'phone' => static fn (CustomerOutput $c) => $c->phone,
                'city' => $city,
                'country' => static fn (CustomerOutput $c) => array_values(array_unique(array_filter(array_map(static fn ($a): ?string => null === $a->city ? null : (string) $a->city->state->country->id, $c->addresses)))),
            ],
            [$name, static fn (CustomerOutput $c) => $c->email, static fn (CustomerOutput $c) => $c->phone, $city],
            static fn (CustomerOutput $c) => $c->id,
        );

        return $this->json(PageOutput::of($page, $query, static fn (CustomerOutput $c) => $c));
    }

    /**
     * Every customer, for the order and invoice pickers (those without an address too). Whoever the legacy order and
     * invoice forms embedded the list for reads it: ROLE_MANAGE_CUSTOMERS, ROLE_CAN_CREATE_ORDERS,
     * ROLE_CAN_UPDATE_ORDERS or ROLE_CAN_CREATE_INVOICES.
     */
    #[Route('/api/v1/customers/all', name: 'api_customers_all', methods: ['GET'])]
    #[IsGranted(new Expression(self::PICKER_ROLES))]
    #[ApiResponse(CustomerOutput::class, list: true)]
    public function all(): JsonResponse
    {
        return $this->json(array_map(CustomerOutput::of(...), $this->customers->all()));
    }

    /**
     * One customer. 404 customer_not_found.
     */
    #[Route('/api/v1/customers/{id}', name: 'api_customers_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class)]
    public function show(int $id): JsonResponse
    {
        return $this->json(CustomerOutput::of($this->customers->byId($id)));
    }

    /**
     * CustomerInput: creates a customer, or, as the legacy form did, updates the one the id, else the email, else the
     * phone names. 422 without a first name or an email.
     */
    #[Route('/api/v1/customers', name: 'api_customers_create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        $input = $this->customerForm($request);

        return $this->json(CustomerOutput::of($this->bus->dispatch($input->toCommand())), 201);
    }

    /**
     * CustomerInput: edits a customer and replaces their addresses. 404 customer_not_found.
     */
    #[Route('/api/v1/customers/{id}', name: 'api_customers_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class)]
    public function update(int $id, Request $request): JsonResponse
    {
        $this->customers->byId($id);
        $input = $this->customerForm($request);

        return $this->json(CustomerOutput::of($this->bus->dispatch($input->toCommand($id))));
    }

    /**
     * Deletes a customer (soft delete, as before), and with them their orders. 204; 404 customer_not_found.
     */
    #[Route('/api/v1/customers/{id}', name: 'api_customers_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    public function delete(int $id): JsonResponse
    {
        $this->bus->dispatch(new DeleteCustomer($id));

        return new JsonResponse(null, 204);
    }

    private function customerForm(Request $request): CustomerInput
    {
        $input = $this->inputs->map($this->inputs->json($request), CustomerInput::class);
        $violations = $this->validator->validate($input, groups: [CustomerInput::FORM]);
        if (\count($violations) > 0) {
            throw ApiValidationException::fromViolations($violations);
        }

        return $input;
    }
}
