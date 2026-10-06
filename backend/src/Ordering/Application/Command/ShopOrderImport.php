<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\ImportedOrderCodes;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Application\Port\ShopOrderMapper;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Ordering\Domain\Repository\ShopDeliveryRepository;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use App\Shared\Domain\Clock;
use Psr\Log\LoggerInterface;

/**
 * Places one WooCommerce order (a webhook's body, a pulled order, an inbox row retried: the same JSON), inside the
 * caller's command, or keeps it in the failed-deliveries inbox with why (docs/pdr/prd-shops-settings.md, Decisions
 * 6 and 7).
 *
 * Everything that can refuse it is checked **before** anything is written — not an order, no lines, a SKU that is no
 * product, no warehouse — so a refusal writes only its inbox row and the command still commits (a result, not an
 * exception). An order the app already holds (the link's UNIQUE(connection, remote id), or RemoteOrderKey over the
 * warehouse's codes, deleted orders included) is a duplicate: logged, nothing stored.
 *
 * Through a connection, the placed order is linked to it (shop_order_link: the order names its shop), the
 * customer's checkout note becomes a `shop` comment (customer notes only: Open questions, answer 2), and the
 * connection's health records the import or the failure.
 */
final class ShopOrderImport
{
    public function __construct(
        private readonly OrderInventory $inventory,
        private readonly ShopOrderMapper $mapper,
        private readonly PlaceOrderHandler $placeOrder,
        private readonly ImportedOrderCodes $importedCodes,
        private readonly OrderRepository $orders,
        private readonly ShopOrderLinkRepository $links,
        private readonly ShopDeliveryRepository $deliveries,
        private readonly CommentMetaRepository $commentMeta,
        private readonly Clock $clock,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @param string            $kind      ShopDelivery::KIND_* (where the order came from)
     * @param mixed             $shopOrder the decoded JSON
     * @param string            $payload   the body as received, kept when it cannot be placed
     * @param ShopDelivery|null $retrying  the inbox row being retried: updated instead of a new one
     */
    public function import(ShopConnection $connection, int $warehouseId, bool $notifyPrinter, string $kind, mixed $shopOrder, string $payload, string $from, ?ShopDelivery $retrying = null): ShopImportResult
    {
        if (!\is_array($shopOrder)) {
            return $this->fail($connection, $kind, null, ShopDelivery::REASON_NOT_AN_ORDER, 'The body is not a WooCommerce order (no JSON object).', $payload, $from, $retrying);
        }
        $remoteId = \is_scalar($shopOrder['id'] ?? null) && '' !== trim((string) $shopOrder['id']) ? trim((string) $shopOrder['id']) : null;

        $duplicate = $this->duplicate($connection, $warehouseId, $remoteId);
        if (false !== $duplicate) {
            $this->logger->info(\sprintf('WooCommerce order [%s] from [%s] is already in warehouse %d: not placed again.', $remoteId, $from, $warehouseId));
            if (null !== $retrying) {
                null === $duplicate
                    ? $retrying->failedAgain(ShopDelivery::REASON_DUPLICATE, 'This shop order is already in the warehouse.', $this->clock->now())
                    : $retrying->placed($this->orders->get($duplicate), $this->clock->now());
            }

            return ShopImportResult::duplicate($duplicate);
        }

        try {
            $placeOrder = $this->mapper->toPlaceOrder($shopOrder, $warehouseId, $notifyPrinter);
        } catch (\UnexpectedValueException $e) {
            return $this->fail($connection, $kind, $remoteId, ShopDelivery::REASON_NOT_AN_ORDER, $e->getMessage(), $payload, $from, $retrying);
        }
        if ([] === $placeOrder->details->lines) {
            return $this->fail($connection, $kind, $remoteId, ShopDelivery::REASON_NO_LINES, 'The order has no line items.', $payload, $from, $retrying);
        }
        $unknown = [];
        foreach ($placeOrder->details->lines as $line) {
            try {
                $this->inventory->product($line->uuid, $line->code);
            } catch (OrderedProductNotFound) {
                $unknown[] = '' === trim((string) $line->code) ? '(no SKU)' : (string) $line->code;
            }
        }
        if ([] !== $unknown) {
            return $this->fail($connection, $kind, $remoteId, ShopDelivery::REASON_UNKNOWN_PRODUCT, 'Unknown product '.implode(', ', array_unique($unknown)), $payload, $from, $retrying);
        }
        try {
            $this->inventory->warehouse($warehouseId);
        } catch (OrderWarehouseNotFound) {
            return $this->fail($connection, $kind, $remoteId, ShopDelivery::REASON_NO_WAREHOUSE, 'The warehouse this shop\'s orders go to no longer exists.', $payload, $from, $retrying);
        }

        $orderId = ($this->placeOrder)($placeOrder);
        $now = $this->clock->now();
        $order = $this->orders->get($orderId);
        if (null !== $remoteId) {
            $status = \is_string($shopOrder['status'] ?? null) ? $shopOrder['status'] : null;
            $this->links->add(new ShopOrderLink($order, $connection, $remoteId, $status, $now));
            $note = \is_string($shopOrder['customer_note'] ?? null) ? trim($shopOrder['customer_note']) : '';
            if ('' !== $note) {
                $comment = new Comment();
                $comment->setContent($note);
                $order->addComment($comment);
                $this->orders->addComment($comment);
                $this->commentMeta->add(new OrderCommentMeta($comment, OrderCommentMeta::ORIGIN_SHOP, $connection));
            }
        }
        $connection->recordImport($now);
        $retrying?->placed($order, $now);

        return ShopImportResult::placed($orderId);
    }

    /**
     * Keeps a delivery the caller already knows it cannot place (a refused signature, an inactive connection) in
     * the inbox.
     */
    public function keep(ShopConnection $connection, string $kind, ?string $remoteId, string $reasonCode, string $reason, ?string $payload): ShopDelivery
    {
        $delivery = new ShopDelivery($connection, $kind, $remoteId, $reasonCode, $reason, $payload, $this->clock->now());
        $this->deliveries->add($delivery);

        return $delivery;
    }

    /**
     * @return int|false|null false: not in the app; null: in the app (by its code, no link); the linked order's id
     */
    private function duplicate(ShopConnection $connection, int $warehouseId, ?string $remoteId): int|false|null
    {
        if (null === $remoteId) {
            return false;
        }
        $link = $this->links->byRemoteOrder($connection, $remoteId);
        if (null !== $link) {
            return (int) $link->order()->getId();
        }
        $key = RemoteOrderKey::ofOrder($warehouseId, $remoteId);
        foreach ($this->importedCodes->of($warehouseId) as $code) {
            $known = RemoteOrderKey::ofOrder($warehouseId, $code);
            if (null !== $key && null !== $known && $known->equals($key)) {
                return null;
            }
        }

        return false;
    }

    private function fail(ShopConnection $connection, string $kind, ?string $remoteId, string $reasonCode, string $reason, string $payload, string $from, ?ShopDelivery $retrying): ShopImportResult
    {
        $now = $this->clock->now();
        $this->logger->error(\sprintf('WooCommerce order [%s] from [%s] was not placed: %s', $remoteId ?? '?', $from, $reason));
        if (null === $retrying) {
            $this->keep($connection, $kind, $remoteId, $reasonCode, $reason, $payload);
        } else {
            $retrying->failedAgain($reasonCode, $reason, $now);
        }
        $connection->recordFailure($now, $reasonCode, $reason);

        return ShopImportResult::failed($reasonCode);
    }
}
