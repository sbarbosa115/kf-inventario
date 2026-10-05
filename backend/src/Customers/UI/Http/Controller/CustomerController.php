<?php

namespace App\Customers\UI\Http\Controller;

use App\Customers\Application\Command\DeleteCustomer;
use App\Customers\Application\Query\Customers;
use App\Customers\UI\Http\Input\CustomerInput;
use App\Customers\UI\Http\Output\CustomerOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\ApiValidationException;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final class CustomerController extends AbstractController
{
    private const MAX_PER_PAGE = 100;

    public function __construct(
        private readonly Customers $customers,
        private readonly CommandBus $bus,
        private readonly InputMapper $inputs,
        private readonly ValidatorInterface $validator,
    ) {
    }

    /**
     * `page` (1…), `per_page` (100 by default and at most, as the legacy list). Customers by id.
     */
    #[Route('/api/v1/customers', name: 'api_customers_page', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class, page: true)]
    public function page(Request $request): JsonResponse
    {
        $page = max(1, $request->query->getInt('page', 1));
        $perPage = min(self::MAX_PER_PAGE, max(1, $request->query->getInt('per_page', self::MAX_PER_PAGE)));

        return $this->json([
            'items' => array_map(CustomerOutput::of(...), $this->customers->page($page, $perPage)),
            'total' => $this->customers->count(),
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    /**
     * Every customer, for the order and invoice pickers (those without an address too).
     */
    #[Route('/api/v1/customers/all', name: 'api_customers_all', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
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
