<?php

namespace App\Ordering\Application\EventHandler;

use App\Ordering\Application\Port\ShopOutboxQueue;
use App\Ordering\Domain\Event\OrderStatusChanged;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use App\Shared\Application\Event\EventHandler;
use App\Shared\Domain\Clock;

/**
 * The write-back of an order's status to the shop it came from (docs/pdr/prd-shops-settings.md, Decisions 10), after
 * the status change committed: Processed → `processing`, Sent and Delivered → `completed`, any other status nothing.
 * Only for an order linked to a connection that is active with its `order_status` capability on, and never the
 * status the app last pushed to that order again. It writes an outbox row and queues it on `shops`; the local change
 * never waits for the shop (PushShopUpdateHandler sends it and retries it).
 */
final class PushOrderStatusToShop implements EventHandler
{
    /** The local status → the WooCommerce status it means. */
    public const SHOP_STATUS = [
        Order::STATUS_PROCESSED => 'processing',
        Order::STATUS_SENT => 'completed',
        Order::STATUS_DELIVERED => 'completed',
    ];

    public function __construct(
        private readonly ShopOrderLinkRepository $links,
        private readonly OrderRepository $orders,
        private readonly ShopOutboxRepository $outbox,
        private readonly ShopOutboxQueue $queue,
        private readonly Clock $clock,
    ) {
    }

    public function __invoke(OrderStatusChanged $event): void
    {
        $shopStatus = self::SHOP_STATUS[$event->status] ?? null;
        if (null === $shopStatus) {
            return;
        }
        $link = $this->links->ofOrder($event->orderId);
        if (null === $link || !$link->connection()->can(ShopCapability::OrderStatus) || $shopStatus === $link->pushedStatus()) {
            return;
        }

        $order = $this->orders->get($event->orderId);
        $entry = new ShopOutbox($link->connection(), $order, ShopCapability::OrderStatus, ['status' => $shopStatus], $this->clock->now());
        $this->outbox->add($entry);
        // The message carries the row's id: the row is written first.
        $this->orders->identify($order);
        $this->queue->enqueue((int) $entry->id());
    }
}
