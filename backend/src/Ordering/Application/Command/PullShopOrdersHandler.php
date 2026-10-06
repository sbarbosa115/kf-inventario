<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\RemoteNote;
use App\Ordering\Application\Port\ShopGateway;
use App\Ordering\Application\Query\Shops;
use App\Ordering\Domain\Error\ShopConnectionNotFound;
use App\Ordering\Domain\Error\ShopUnreachable;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/**
 * The catch-up pull of one connection (docs/pdr/prd-shops-settings.md, Decisions 11). One read of the shop's orders
 * modified since the connection's cursor, in any status (no cursor yet: the gateway's 30-day window):
 *
 * - a `processing` order is imported as the webhook imports it (ShopOrderImport: placed and linked, a duplicate
 *   skipped, one that cannot be placed kept in the inbox, kind `pull`);
 * - an order linked to this connection gets its shop status recorded and its **customer** notes imported as `shop`
 *   comments, each once (keyed by the note's id); the app's own notes are private on the shop, so never read back.
 *
 * The cursor moves to the newest `date_modified_gmt` seen, only when the shop answered every call; otherwise the
 * connection's health records the failure (`pull_failed`) and the next pull reads the same window again — what was
 * placed stays placed and is a duplicate then. Never throws for a shop: the result says.
 */
final class PullShopOrdersHandler implements CommandHandler
{
    public const FAILURE_CODE = 'pull_failed';
    /** What the pull reads: every status (the new orders are the `processing` ones). */
    public const READ_STATUS = 'any';
    public const PLACED_STATUS = 'processing';

    public function __construct(
        private readonly Shops $shops,
        private readonly ShopGateway $gateway,
        private readonly ShopOrderImport $import,
        private readonly ShopOrderLinkRepository $links,
        private readonly CommentMetaRepository $commentMeta,
        private readonly OrderRepository $orders,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @throws ShopConnectionNotFound
     */
    public function __invoke(PullShopOrders $command): PulledShopOrders
    {
        $connection = $this->shops->get($command->connectionId);
        $id = (int) $connection->id();
        if (!$connection->isActive()) {
            return new PulledShopOrders($id, $connection->name());
        }

        $now = $this->clock->now();
        $keys = $this->shops->credentials($connection);
        $imported = 0;
        $skipped = 0;
        $newest = null;
        try {
            foreach ($this->gateway->ordersModifiedSince($keys, $connection->pullCursor(), self::READ_STATUS) as $shopOrder) {
                $newest = self::newer($newest, self::modifiedAt($shopOrder));
                $remoteId = \is_scalar($shopOrder['id'] ?? null) ? trim((string) $shopOrder['id']) : '';
                $status = \is_string($shopOrder['status'] ?? null) ? $shopOrder['status'] : null;

                $order = null;
                if (self::PLACED_STATUS === $status) {
                    $result = $this->import->import($connection, (int) $connection->warehouse()->getId(), $connection->emailsPrinter(), ShopDelivery::KIND_PULL, $shopOrder, self::json($shopOrder), $connection->name());
                    $result->isPlaced() ? ++$imported : ++$skipped;
                    if ($result->isPlaced() && null !== $result->orderId) {
                        $order = $this->orders->get($result->orderId);
                    }
                }
                if (null === $order && '' !== $remoteId) {
                    $link = $this->links->byRemoteOrder($connection, $remoteId);
                    if (null !== $link && null !== $status) {
                        $link->seenRemoteStatus($status);
                    }
                    $order = $link?->order();
                }
                if (null !== $order && '' !== $remoteId) {
                    $this->importNotes($connection, $order, $this->gateway->orderNotes($keys, $remoteId));
                }
            }
        } catch (ShopUnreachable $e) {
            $connection->recordPull($now, false);
            $connection->recordFailure($now, self::FAILURE_CODE, $e->reason());

            return new PulledShopOrders($id, $connection->name(), $imported, $skipped, $e->reason());
        }

        $connection->recordPull($now, true, $newest);

        return new PulledShopOrders($id, $connection->name(), $imported, $skipped);
    }

    /**
     * @param list<RemoteNote> $notes
     */
    private function importNotes(ShopConnection $connection, Order $order, array $notes): void
    {
        foreach ($notes as $note) {
            if (!$note->customerNote || '' === trim($note->note)) {
                continue;
            }
            if (null !== $this->commentMeta->byRemoteNote($connection, $note->id)) {
                continue;
            }
            $comment = new Comment();
            $comment->setContent(trim($note->note));
            if (null !== $note->createdAt) {
                // Dates are written in the server's time zone (America/Bogota), as every date of the app.
                $comment->setCreatedAt(\DateTime::createFromImmutable($note->createdAt->setTimezone(new \DateTimeZone(date_default_timezone_get()))));
            }
            $order->addComment($comment);
            $this->orders->addComment($comment);
            $this->commentMeta->add(new OrderCommentMeta($comment, OrderCommentMeta::ORIGIN_SHOP, $connection, $note->id));
        }
    }

    /**
     * @param array<mixed> $shopOrder
     */
    private static function modifiedAt(array $shopOrder): ?\DateTimeImmutable
    {
        $gmt = $shopOrder['date_modified_gmt'] ?? null;
        if (!\is_string($gmt) || '' === $gmt) {
            return null;
        }
        try {
            return (new \DateTimeImmutable($gmt, new \DateTimeZone('UTC')))->setTimezone(new \DateTimeZone(date_default_timezone_get()));
        } catch (\Exception) {
            return null;
        }
    }

    private static function newer(?\DateTimeImmutable $a, ?\DateTimeImmutable $b): ?\DateTimeImmutable
    {
        if (null === $a || null === $b) {
            return $a ?? $b;
        }

        return $b > $a ? $b : $a;
    }

    /**
     * @param array<mixed> $shopOrder
     */
    private static function json(array $shopOrder): string
    {
        return (string) json_encode($shopOrder, \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE | \JSON_INVALID_UTF8_SUBSTITUTE);
    }
}
