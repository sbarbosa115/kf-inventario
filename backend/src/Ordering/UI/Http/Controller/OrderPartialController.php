<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\Application\Command\OrderLine;
use App\Ordering\Application\Command\RecordPartialShipment;
use App\Ordering\Application\Query\OrderPartials;
use App\Ordering\UI\Http\Input\OrderLineInput;
use App\Ordering\UI\Http\Input\PartialInput;
use App\Ordering\UI\Http\OrderPresenter;
use App\Ordering\UI\Http\Output\OrderPartialsOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The getting-ready screen: an order's partial shipments.
 */
final class OrderPartialController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly OrderPartials $partials,
        private readonly InputMapper $inputs,
        private readonly OrderPresenter $presenter,
    ) {
    }

    /**
     * What was shipped, what is left, and the warehouse's stock of the order's products. As before: any signed-in
     * user.
     */
    #[Route('/api/v1/orders/{id}/partials', name: 'api_orders_partials', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderPartialsOutput::class)]
    public function show(int $id): JsonResponse
    {
        return $this->json($this->presenter->partials($this->partials->of($id)));
    }

    /**
     * PartialInput: ships these products now. Exactly the whole order, in stock: the order is sent (status 5);
     * otherwise a partial shipment (status 4). Either way the products leave the order's warehouse. 409
     * partial_exceeds_order (more than what is left, or the order is already sent); 422 insufficient_stock (the
     * warehouse holds fewer); 404 stock_not_found (the warehouse has none of a product at all).
     */
    #[Route('/api/v1/orders/{id}/partials', name: 'api_orders_partials_record', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderPartialsOutput::class)]
    public function record(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), PartialInput::class);

        $this->commands->dispatch(new RecordPartialShipment(
            $id,
            array_map(static fn (OrderLineInput $line) => new OrderLine($line->uuid, $line->code, $line->quantity), $input->items),
        ));

        return $this->json($this->presenter->partials($this->partials->of($id)));
    }
}
