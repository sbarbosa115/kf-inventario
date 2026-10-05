<?php

namespace App\Ordering\UI\Http\Controller;

use App\Customers\UI\Http\Input\AddressInput;
use App\Identity\Domain\Model\User;
use App\Ordering\Application\Command\ChangeOrderStatus;
use App\Ordering\Application\Command\CommentLine;
use App\Ordering\Application\Command\DeleteOrder;
use App\Ordering\Application\Command\OrderAddress;
use App\Ordering\Application\Command\OrderCustomer;
use App\Ordering\Application\Command\OrderDetails;
use App\Ordering\Application\Command\OrderLine;
use App\Ordering\Application\Command\PlaceOrder;
use App\Ordering\Application\Command\SyncedOrders;
use App\Ordering\Application\Command\SyncOrderComments;
use App\Ordering\Application\Command\SyncRemoteOrders;
use App\Ordering\Application\Command\UpdateOrder;
use App\Ordering\Application\Query\Orders;
use App\Ordering\UI\Http\Input\OrderCommentInput;
use App\Ordering\UI\Http\Input\OrderCommentsInput;
use App\Ordering\UI\Http\Input\OrderInput;
use App\Ordering\UI\Http\Input\OrderLineInput;
use App\Ordering\UI\Http\Input\OrderStatusInput;
use App\Ordering\UI\Http\OrderPresenter;
use App\Ordering\UI\Http\Output\OrderCommentOutput;
use App\Ordering\UI\Http\Output\OrderDetailOutput;
use App\Ordering\UI\Http\Output\OrderOutput;
use App\Ordering\UI\Http\Output\SyncResultOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\ApiValidationException;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Orders typed by hand: the list, the detail, the order form (place, edit), the status, the comments, the delete.
 */
final class OrderController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly Orders $orders,
        private readonly InputMapper $inputs,
        private readonly OrderPresenter $presenter,
    ) {
    }

    /**
     * `warehouse_id`: that warehouse's orders, newest first (the list filters and pages them in the browser).
     */
    #[Route('/api/v1/orders', name: 'api_orders_list', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    #[ApiResponse(OrderOutput::class, list: true)]
    public function list(Request $request): JsonResponse
    {
        $warehouseId = $request->query->getInt('warehouse_id');
        if ($warehouseId < 1) {
            throw ApiValidationException::single('warehouse_id', 'This value should be positive.');
        }

        return $this->json(array_map($this->presenter->order(...), $this->orders->ofWarehouse($warehouseId)));
    }

    /**
     * One order with its customer (and addresses), comments and products. 404 order_not_found.
     */
    #[Route('/api/v1/orders/{id}', name: 'api_orders_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class)]
    public function show(int $id): JsonResponse
    {
        return $this->json($this->presenter->detail($this->orders->get($id)));
    }

    /**
     * OrderInput: places an order (the customer is found by id, email or phone and updated, or created); the printer
     * gets its email. 422 order_without_products; 404 product_not_found, warehouse_not_found.
     */
    #[Route('/api/v1/orders', name: 'api_orders_create', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_CREATE_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), OrderInput::class);

        $id = $this->commands->dispatch(new PlaceOrder(
            details: self::details($input),
            comments: array_map(static fn (OrderCommentInput $comment) => $comment->content, $input->comments),
            authorId: $this->currentUser()->getId(),
        ));

        return $this->json($this->presenter->detail($this->orders->get($id)), 201);
    }

    /**
     * OrderInput: edits an order (its comments are not touched: PUT …/comments). 404 order_not_found.
     */
    #[Route('/api/v1/orders/{id}', name: 'api_orders_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_UPDATE_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class)]
    public function update(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), OrderInput::class);

        $this->commands->dispatch(new UpdateOrder($id, self::details($input)));

        return $this->json($this->presenter->detail($this->orders->get($id)));
    }

    /**
     * OrderStatusInput: moves the order to another status (a status history row; stock is not touched).
     */
    #[Route('/api/v1/orders/{id}/status', name: 'api_orders_status', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_UPDATE_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class)]
    public function changeStatus(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), OrderStatusInput::class);

        $this->commands->dispatch(new ChangeOrderStatus($id, $input->status));

        return $this->json($this->presenter->detail($this->orders->get($id)));
    }

    /**
     * OrderCommentsInput: the order's comments as they should be: no id adds one (signed by you), an id edits it, a
     * comment left out leaves the order. As before: any signed-in user.
     */
    #[Route('/api/v1/orders/{id}/comments', name: 'api_orders_comments', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class, list: true, key: 'comments')]
    public function syncComments(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), OrderCommentsInput::class);

        $this->commands->dispatch(new SyncOrderComments(
            $id,
            array_map(static fn (OrderCommentInput $comment) => new CommentLine($comment->id, $comment->content), $input->comments),
            $this->currentUser()->getId() ?? 0,
        ));

        return $this->json(['comments' => $this->presenter->comments($this->orders->get($id))]);
    }

    /**
     * Deletes an order: its product lines and comments, then the order (soft delete: it is not found any more). 204.
     */
    #[Route('/api/v1/orders/{id}', name: 'api_orders_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_DELETE_ORDERS')]
    public function delete(int $id): Response
    {
        $this->commands->dispatch(new DeleteOrder($id));

        return new Response(status: 204);
    }

    /**
     * Pulls the orders the WooCommerce shops have waiting (REST API) and places the ones the app does not have yet,
     * as the webhook would: `imported` placed, `skipped` already imported (deleted ones included) or not placeable
     * (logged). A warehouse whose shop the app holds no keys for is not pulled. 502 order_sync_failed when a shop
     * cannot be read (nothing is kept).
     */
    #[Route('/api/v1/orders/sync', name: 'api_orders_sync', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_SYNC_ORDERS')]
    #[ApiResponse(SyncResultOutput::class, status: 202)]
    public function sync(): JsonResponse
    {
        $synced = $this->commands->dispatch(new SyncRemoteOrders());
        if (!$synced instanceof SyncedOrders) {
            throw new \LogicException('SyncRemoteOrdersHandler answers what it did.');
        }

        return $this->json(new SyncResultOutput($synced->imported, $synced->skipped), 202);
    }

    private static function details(OrderInput $input): OrderDetails
    {
        $customer = $input->customer;

        return new OrderDetails(
            code: $input->code,
            status: $input->status,
            source: $input->source,
            paymentMethod: $input->paymentMethod,
            comment: $input->comment,
            warehouseId: $input->warehouseId,
            customer: new OrderCustomer(
                id: $customer?->id,
                firstName: $customer?->firstName,
                lastName: $customer?->lastName,
                email: $customer?->email,
                phone: $customer?->phone,
                addresses: array_map(static fn (AddressInput $address) => new OrderAddress(
                    address: $address->address,
                    zipCode: $address->zipCode,
                    addressType: $address->addressType,
                    cityId: $address->city?->id,
                    cityName: $address->city?->name,
                    stateId: $address->city?->state?->id,
                    stateName: $address->city?->state?->name,
                    countryId: $address->city?->state?->country?->id,
                    countryName: $address->city?->state?->country?->name,
                    stateCode: $address->city?->state?->code,
                    countryCode: $address->city?->state?->country?->code,
                ), $customer->addresses ?? []),
            ),
            lines: array_map(static fn (OrderLineInput $line) => new OrderLine($line->uuid, $line->code, $line->quantity), $input->products),
        );
    }

    private function currentUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw new \LogicException('The firewall lets only signed-in users of the user table reach the orders API.');
        }

        return $user;
    }
}
