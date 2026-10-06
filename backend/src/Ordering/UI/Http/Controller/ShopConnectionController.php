<?php

namespace App\Ordering\UI\Http\Controller;

use App\Inventory\UI\Http\Output\WarehouseRefOutput;
use App\Ordering\Application\Command\CreatedShopConnection;
use App\Ordering\Application\Command\CreateShopConnection;
use App\Ordering\Application\Command\DeleteShopConnection;
use App\Ordering\Application\Command\DiscardShopDelivery;
use App\Ordering\Application\Command\RetryShopDelivery;
use App\Ordering\Application\Command\RotateShopWebhookSecret;
use App\Ordering\Application\Command\ShopConnectionDetails;
use App\Ordering\Application\Command\UpdateShopConnection;
use App\Ordering\Application\Query\Shops;
use App\Ordering\Application\Query\ShopsTester;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\UI\Http\Input\ShopConnectionInput;
use App\Ordering\UI\Http\Input\ShopTestInput;
use App\Ordering\UI\Http\Output\DeliveryLineOutput;
use App\Ordering\UI\Http\Output\DeliverySummaryOutput;
use App\Ordering\UI\Http\Output\OrderRefOutput;
use App\Ordering\UI\Http\Output\ShopCapabilitiesOutput;
use App\Ordering\UI\Http\Output\ShopConnectionOutput;
use App\Ordering\UI\Http\Output\ShopDeliveryDetailOutput;
use App\Ordering\UI\Http\Output\ShopDeliveryOutput;
use App\Ordering\UI\Http\Output\ShopHealthOutput;
use App\Ordering\UI\Http\Output\ShopRestTestOutput;
use App\Ordering\UI\Http\Output\ShopTestResultOutput;
use App\Ordering\UI\Http\Output\WebhookSecretOutput;
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
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Shop connections and their failed-deliveries inbox (docs/pdr/prd-shops-settings.md, "API changes" › Shop
 * connections), for an admin. Never a consumer key or secret in an answer (`has_keys`); the webhook secret only in
 * the answer that created the connection and in GET/POST …/webhook-secret (the value to paste in WooCommerce).
 */
#[IsGranted('ROLE_ADMIN')]
final class ShopConnectionController extends AbstractController
{
    public function __construct(
        private readonly Shops $shops,
        private readonly ShopsTester $tester,
        private readonly CommandBus $commands,
        private readonly InputMapper $mapper,
        private readonly ListQueryParser $lists,
    ) {
    }

    /** The inbox's list contract: `?status=failed` is the same as filter[status][]=failed. */
    public static function deliveriesSchema(): ListSchema
    {
        return new ListSchema(
            fields: [
                'status' => ListField::enum([ShopDelivery::STATUS_FAILED, ShopDelivery::STATUS_PLACED, ShopDelivery::STATUS_DISCARDED]),
                'kind' => ListField::enum([ShopDelivery::KIND_WEBHOOK, ShopDelivery::KIND_PULL, ShopDelivery::KIND_LEGACY]),
                'reason_code' => ListField::enum([
                    ShopDelivery::REASON_BAD_SIGNATURE, ShopDelivery::REASON_UNKNOWN_PRODUCT, ShopDelivery::REASON_NO_WAREHOUSE, ShopDelivery::REASON_NOT_AN_ORDER,
                    ShopDelivery::REASON_NO_LINES, ShopDelivery::REASON_DUPLICATE, ShopDelivery::REASON_INACTIVE,
                ]),
                'received_at' => ListField::date(),
                'remote_order_id' => ListField::text(),
                'customer' => ListField::text(),
            ],
            sorts: ['received_at', 'remote_order_id'],
            defaultSort: '-received_at',
        );
    }

    /**
     * Every connection by name, with its health.
     */
    #[Route('/api/v1/shops', name: 'api_shops_list', methods: ['GET'])]
    #[ApiResponse(ShopConnectionOutput::class, list: true)]
    public function list(Request $request): JsonResponse
    {
        return $this->json(array_map(fn (ShopConnection $c) => $this->present($c, $request), $this->shops->all()));
    }

    /**
     * One connection. 404 shop_not_found.
     */
    #[Route('/api/v1/shops/{id}', name: 'api_shops_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopConnectionOutput::class)]
    public function show(int $id, Request $request): JsonResponse
    {
        return $this->json($this->present($this->shops->get($id), $request));
    }

    /**
     * ShopConnectionInput → 201 with `webhook_secret` (once) and `webhook_url`. 409 shop_url_taken, shop_name_taken;
     * 404 warehouse_not_found; 422 shop_url_invalid (not https, a private host; `detail.reason` says which).
     */
    #[Route('/api/v1/shops', name: 'api_shops_create', methods: ['POST'])]
    #[ApiResponse(ShopConnectionOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        /** @var CreatedShopConnection $created */
        $created = $this->commands->dispatch(new CreateShopConnection($this->details($request)));

        return $this->json($this->present($this->shops->get($created->id()), $request, $created->webhookSecret), 201);
    }

    /**
     * ShopConnectionInput: blank consumer_key/consumer_secret keep the saved ones. 404 shop_not_found; the create's
     * 409 and 422.
     */
    #[Route('/api/v1/shops/{id}', name: 'api_shops_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopConnectionOutput::class)]
    public function update(int $id, Request $request): JsonResponse
    {
        $this->shops->get($id);
        $this->commands->dispatch(new UpdateShopConnection($id, $this->details($request)));

        return $this->json($this->present($this->shops->get($id), $request));
    }

    /**
     * 204; 409 shop_has_orders when orders came from it (deactivate it instead). Its inbox goes with it.
     */
    #[Route('/api/v1/shops/{id}', name: 'api_shops_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): Response
    {
        $this->commands->dispatch(new DeleteShopConnection($id));

        return new Response(null, 204);
    }

    /**
     * The webhook URL and signing secret to paste in WooCommerce (the consumer secret is never readable).
     */
    #[Route('/api/v1/shops/{id}/webhook-secret', name: 'api_shops_webhook_secret', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(WebhookSecretOutput::class)]
    public function webhookSecret(int $id, Request $request): JsonResponse
    {
        $connection = $this->shops->get($id);

        return $this->json(new WebhookSecretOutput($this->shops->webhookSecret($connection), $connection->webhookUrl($request->getSchemeAndHttpHost())));
    }

    /**
     * Rotates the signing secret → the new one, to paste. Deliveries signed with the old one are refused from now.
     */
    #[Route('/api/v1/shops/{id}/webhook-secret', name: 'api_shops_webhook_secret_rotate', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[ApiResponse(WebhookSecretOutput::class)]
    public function rotateWebhookSecret(int $id, Request $request): JsonResponse
    {
        $this->commands->dispatch(new RotateShopWebhookSecret($id));

        return $this->webhookSecret($id, $request);
    }

    /**
     * ShopTestInput (the URL and keys as typed, each blank one the saved one): "Test connection", 15 s, never an
     * error status — `rest.ok` and `rest.error` say what happened. 404 shop_not_found.
     */
    #[Route('/api/v1/shops/{id}/test', name: 'api_shops_test', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopTestResultOutput::class)]
    public function test(int $id, Request $request): JsonResponse
    {
        $connection = $this->shops->get($id);
        $data = '' === trim($request->getContent()) ? [] : $this->mapper->json($request);
        $input = $this->mapper->map($data, ShopTestInput::class);

        $outcome = $this->tester->test($connection, $input->siteUrl, $input->consumerKey, $input->consumerSecret);

        return $this->json(new ShopTestResultOutput(
            new ShopRestTestOutput($outcome->ok, $outcome->storeName, $outcome->wcVersion, $outcome->canWrite, $outcome->error),
            $connection->webhookUrl($request->getSchemeAndHttpHost()),
            true,
        ));
    }

    /**
     * A page of the connection's inbox, newest first (the list contract: `?status=failed` or filter[status][],
     * filter[kind][], filter[reason_code][], filter[received_at][from|to], filter[remote_order_id], filter[customer];
     * q over the shop order number and the customer).
     */
    #[Route('/api/v1/shops/{id}/deliveries', name: 'api_shops_deliveries', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopDeliveryOutput::class, page: true)]
    public function deliveries(int $id, Request $request): JsonResponse
    {
        $connection = $this->shops->get($id);
        $status = $request->query->get('status');
        if (\is_string($status) && '' !== $status) {
            $filter = $request->query->all('filter');
            $filter['status'] ??= [$status];
            $request->query->set('filter', $filter);
        }
        $query = $this->lists->parse($request, self::deliveriesSchema());

        $page = InMemoryList::page(
            array_map(self::row(...), $this->shops->deliveries($connection)),
            $query,
            [
                'status' => static fn (ShopDeliveryOutput $d) => $d->status,
                'kind' => static fn (ShopDeliveryOutput $d) => $d->kind,
                'reason_code' => static fn (ShopDeliveryOutput $d) => $d->reasonCode,
                'received_at' => static fn (ShopDeliveryOutput $d) => new \DateTimeImmutable($d->receivedAt),
                'remote_order_id' => static fn (ShopDeliveryOutput $d) => $d->remoteOrderId,
                'customer' => static fn (ShopDeliveryOutput $d) => $d->summary->customer,
            ],
            [static fn (ShopDeliveryOutput $d) => $d->remoteOrderId, static fn (ShopDeliveryOutput $d) => $d->summary->customer],
            static fn (ShopDeliveryOutput $d) => $d->id,
        );

        return $this->json(PageOutput::of($page, $query, static fn (ShopDeliveryOutput $d) => $d));
    }

    /**
     * One inbox row with its body. 404 delivery_not_found (also another connection's).
     */
    #[Route('/api/v1/shops/{id}/deliveries/{deliveryId}', name: 'api_shops_delivery', methods: ['GET'], requirements: ['id' => '\d+', 'deliveryId' => '\d+'])]
    #[ApiResponse(ShopDeliveryDetailOutput::class)]
    public function delivery(int $id, int $deliveryId): JsonResponse
    {
        $delivery = $this->shops->delivery($this->shops->get($id), $deliveryId);
        $row = self::row($delivery);

        return $this->json(new ShopDeliveryDetailOutput($row->id, $row->kind, $row->remoteOrderId, $row->status, $row->reasonCode, $row->reason, $row->receivedAt, $row->attempts, $row->order, $row->summary, $delivery->payload()));
    }

    /**
     * Runs the import again from the stored body: `placed` with its order, or still `failed` with the new reason.
     */
    #[Route('/api/v1/shops/{id}/deliveries/{deliveryId}/retry', name: 'api_shops_delivery_retry', methods: ['POST'], requirements: ['id' => '\d+', 'deliveryId' => '\d+'])]
    #[ApiResponse(ShopDeliveryOutput::class)]
    public function retryDelivery(int $id, int $deliveryId): JsonResponse
    {
        $this->commands->dispatch(new RetryShopDelivery($id, $deliveryId));

        return $this->json(self::row($this->shops->delivery($this->shops->get($id), $deliveryId)));
    }

    /**
     * Marks the row discarded (a placed row stays placed).
     */
    #[Route('/api/v1/shops/{id}/deliveries/{deliveryId}/discard', name: 'api_shops_delivery_discard', methods: ['POST'], requirements: ['id' => '\d+', 'deliveryId' => '\d+'])]
    #[ApiResponse(ShopDeliveryOutput::class)]
    public function discardDelivery(int $id, int $deliveryId): JsonResponse
    {
        $this->commands->dispatch(new DiscardShopDelivery($id, $deliveryId));

        return $this->json(self::row($this->shops->delivery($this->shops->get($id), $deliveryId)));
    }

    private function details(Request $request): ShopConnectionDetails
    {
        $input = $this->mapper->map($this->mapper->json($request), ShopConnectionInput::class);

        return new ShopConnectionDetails(
            $input->name,
            $input->siteUrl,
            $input->consumerKey,
            $input->consumerSecret,
            $input->warehouseId,
            $input->emailPrinter,
            $input->active,
            array_map(static fn (mixed $on): bool => true === $on, $input->capabilities),
        );
    }

    private function present(ShopConnection $connection, Request $request, ?string $webhookSecret = null): ShopConnectionOutput
    {
        $capabilities = $connection->capabilities();

        return new ShopConnectionOutput(
            id: (int) $connection->id(),
            name: $connection->name(),
            siteUrl: $connection->siteUrl(),
            active: $connection->isActive(),
            warehouse: new WarehouseRefOutput((int) $connection->warehouse()->getId(), (string) $connection->warehouse()->getName()),
            emailPrinter: $connection->emailsPrinter(),
            capabilities: new ShopCapabilitiesOutput($capabilities[ShopCapability::OrderStatus->value] ?? false, $capabilities[ShopCapability::OrderNote->value] ?? false),
            webhookUrl: $connection->webhookUrl($request->getSchemeAndHttpHost()),
            hasKeys: $this->shops->hasKeys($connection),
            health: new ShopHealthOutput(
                self::date($connection->lastWebhookAt()),
                self::date($connection->lastImportAt()),
                self::date($connection->lastPullAt()),
                self::date($connection->lastPullOkAt()),
                self::date($connection->lastFailureAt()),
                $connection->lastFailureCode(),
                $connection->lastFailure(),
                $this->shops->failedDeliveries($connection),
                $this->shops->failedPushes($connection),
            ),
            webhookSecret: $webhookSecret,
        );
    }

    private static function row(ShopDelivery $delivery): ShopDeliveryOutput
    {
        $order = $delivery->order();

        return new ShopDeliveryOutput(
            id: (int) $delivery->id(),
            kind: $delivery->kind(),
            remoteOrderId: $delivery->remoteOrderId(),
            status: $delivery->status(),
            reasonCode: $delivery->reasonCode(),
            reason: $delivery->reason(),
            receivedAt: $delivery->receivedAt()->format(\DATE_ATOM),
            attempts: $delivery->attempts(),
            order: null === $order ? null : new OrderRefOutput((int) $order->getId(), $order->getCode()),
            summary: self::summary($delivery->payload()),
        );
    }

    /**
     * Who ordered and what, read from the stored body (billing name, else email; line items' SKU and quantity).
     */
    private static function summary(?string $payload): DeliverySummaryOutput
    {
        $order = null === $payload ? null : json_decode($payload, true);
        if (!\is_array($order)) {
            return new DeliverySummaryOutput(null, []);
        }
        $billing = \is_array($order['billing'] ?? null) ? $order['billing'] : [];
        $name = trim(self::text($billing, 'first_name').' '.self::text($billing, 'last_name'));
        $customer = '' !== $name ? $name : (self::text($billing, 'email') ?: null);
        $lines = [];
        foreach (\is_array($order['line_items'] ?? null) ? $order['line_items'] : [] as $item) {
            if (\is_array($item)) {
                $lines[] = new DeliveryLineOutput('' === self::text($item, 'sku') ? null : self::text($item, 'sku'), (int) (\is_numeric($item['quantity'] ?? null) ? $item['quantity'] : 0));
            }
        }

        return new DeliverySummaryOutput($customer, $lines);
    }

    /**
     * @param array<mixed> $data
     */
    private static function text(array $data, string $key): string
    {
        return \is_scalar($data[$key] ?? null) ? trim((string) $data[$key]) : '';
    }

    private static function date(?\DateTimeImmutable $at): ?string
    {
        return $at?->format(\DATE_ATOM);
    }
}
