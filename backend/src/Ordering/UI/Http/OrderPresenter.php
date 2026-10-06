<?php

namespace App\Ordering\UI\Http;

use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Customers\UI\Http\Output\AddressOutput;
use App\Customers\UI\Http\Output\CityRefOutput;
use App\Customers\UI\Http\Output\CountryRefOutput;
use App\Customers\UI\Http\Output\CustomerOutput;
use App\Customers\UI\Http\Output\CustomerRefOutput;
use App\Customers\UI\Http\Output\StateRefOutput;
use App\Identity\Domain\Model\User;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\UI\Http\Output\StockOutput;
use App\Inventory\UI\Http\Output\WarehouseRefOutput;
use App\Ordering\Application\Port\ShopOrderLinks;
use App\Ordering\Application\Port\ShopRef;
use App\Ordering\Application\Query\OrderComments;
use App\Ordering\Domain\Error\CommentNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\OrderProduct;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\UI\Http\Output\CommentAuthorOutput;
use App\Ordering\UI\Http\Output\OrderCommentOutput;
use App\Ordering\UI\Http\Output\OrderDetailOutput;
use App\Ordering\UI\Http\Output\OrderLineOutput;
use App\Ordering\UI\Http\Output\OrderLineProductOutput;
use App\Ordering\UI\Http\Output\OrderOutput;
use App\Ordering\UI\Http\Output\OrderPartialsOutput;
use App\Ordering\UI\Http\Output\PartialLineOutput;
use App\Ordering\UI\Http\Output\PartialLineProductOutput;
use App\Ordering\UI\Http\Output\PendingLineOutput;
use App\Ordering\UI\Http\Output\PinnedCommentOutput;
use App\Ordering\UI\Http\Output\ShopRefOutput;

/**
 * Orders as the API answers them (the Output DTOs of the route map).
 */
final class OrderPresenter
{
    public function __construct(
        private readonly ShopOrderLinks $links,
        private readonly CommentMetaRepository $metas,
        private readonly OrderComments $timeline,
    ) {
    }

    public function order(Order $order): OrderOutput
    {
        return $this->orders([$order])[0];
    }

    /**
     * The list's rows, with each order's shop and pinned comment read in one query each.
     *
     * @param list<Order> $orders
     *
     * @return list<OrderOutput>
     */
    public function orders(array $orders): array
    {
        $ids = array_map(static fn (Order $o): int => (int) $o->getId(), $orders);
        $shops = $this->links->shopsOf($ids);
        $pinned = $this->metas->pinnedOfOrders($ids);

        return array_map(fn (Order $order): OrderOutput => $this->row($order, $shops[(int) $order->getId()] ?? null, $pinned[(int) $order->getId()] ?? null), $orders);
    }

    private function row(Order $order, ?ShopRef $shop, ?OrderCommentMeta $pinned): OrderOutput
    {
        $customer = $order->getCustomer();

        return new OrderOutput(
            id: (int) $order->getId(),
            code: $order->getCode(),
            status: (int) $order->getStatus(),
            source: (int) $order->getSource(),
            paymentMethod: $order->getPaymentMethod(),
            comment: $order->getComment(),
            createdAt: $order->getCreatedAt()?->format(\DATE_ATOM),
            warehouse: self::warehouse($order->getWarehouse()),
            customer: null === $customer ? null : new CustomerRefOutput((int) $customer->getId(), $customer->getFirstName(), $customer->getLastName(), $customer->getEmail(), $customer->getPhone()),
            commentsCount: $order->getComments()->count(),
            shop: self::shop($shop),
            pinnedComment: self::pinned($order, $pinned),
        );
    }

    public function detail(Order $order): OrderDetailOutput
    {
        $id = (int) $order->getId();

        return new OrderDetailOutput(
            id: (int) $order->getId(),
            code: $order->getCode(),
            status: (int) $order->getStatus(),
            source: (int) $order->getSource(),
            paymentMethod: $order->getPaymentMethod(),
            comment: $order->getComment(),
            createdAt: $order->getCreatedAt()?->format(\DATE_ATOM),
            warehouse: self::warehouse($order->getWarehouse()),
            customer: self::customer($order->getCustomer()),
            comments: $this->comments($order),
            products: self::lines($order),
            shop: self::shop($this->links->shopsOf([$id])[$id] ?? null),
            pinnedComment: self::pinned($order, $this->metas->pinnedOfOrders([$id])[$id] ?? null),
        );
    }

    /**
     * The order's comments as the timeline reads them, oldest first (OrderComments): a legacy comment without a date
     * carries the order's, marked approximate; a comment without metadata is an `app` comment, not pinned
     * (docs/pdr/prd-shops-settings.md, Decisions 14). The metadata of every comment is read in one query.
     *
     * @return list<OrderCommentOutput>
     */
    public function comments(Order $order): array
    {
        $comments = $this->timeline->timeline($order);
        $metas = $this->metas->ofComments(array_map(static fn (Comment $c): int => (int) $c->getId(), $comments));

        return array_map(static fn (Comment $comment): OrderCommentOutput => self::comment($order, $comment, $metas[(int) $comment->getId()] ?? null), $comments);
    }

    /**
     * One comment of the order, as the timeline shows it (the answer of add, pin and unpin).
     *
     * @throws CommentNotFound
     */
    public function commentOf(Order $order, int $commentId): OrderCommentOutput
    {
        $comment = $this->timeline->of($order, $commentId);

        return self::comment($order, $comment, $this->metas->ofComment($commentId));
    }

    private static function comment(Order $order, Comment $comment, ?OrderCommentMeta $meta): OrderCommentOutput
    {
        $at = $comment->getCreatedAt() ?? $order->getCreatedAt();
        $connection = $meta?->connection();

        return new OrderCommentOutput(
            id: (int) $comment->getId(),
            content: $comment->getContent(),
            createdAt: $at?->format(\DATE_ATOM),
            approximate: null === $comment->getCreatedAt(),
            author: self::author($comment->getUser()),
            origin: $meta?->origin() ?? OrderCommentMeta::ORIGIN_APP,
            shop: null === $connection ? null : new ShopRefOutput((int) $connection->id(), $connection->name(), $connection->isActive() && $connection->can(ShopCapability::OrderNote)),
            pinned: $meta?->isPinned() ?? false,
            pinnedAt: $meta?->pinnedAt()?->format(\DATE_ATOM),
            pinnedBy: self::author($meta?->pinnedBy()),
            sentToShop: $meta?->sendsToShop() ?? false,
        );
    }

    private static function shop(?ShopRef $shop): ?ShopRefOutput
    {
        return null === $shop ? null : new ShopRefOutput($shop->id, $shop->name, $shop->takesNotes);
    }

    private static function pinned(Order $order, ?OrderCommentMeta $meta): ?PinnedCommentOutput
    {
        if (null === $meta || !$meta->isPinned()) {
            return null;
        }
        $comment = $meta->comment();

        return new PinnedCommentOutput((int) $comment->getId(), (string) $comment->getContent(), ($comment->getCreatedAt() ?? $order->getCreatedAt())?->format(\DATE_ATOM));
    }

    private static function author(?User $user): ?CommentAuthorOutput
    {
        return null === $user ? null : new CommentAuthorOutput((int) $user->getId(), (string) ($user->getName() ?? $user->getUsername()));
    }

    /**
     * @param array{order: Order, aggregate: list<array{quantity: int|null, uuid: string, product: array{code: string}}>, pending: list<array{uuid: string, quantity: int}>, inventory: list<ProductWarehouse>} $partials
     */
    public function partials(array $partials): OrderPartialsOutput
    {
        return new OrderPartialsOutput(
            orderId: (int) $partials['order']->getId(),
            code: $partials['order']->getCode(),
            status: (int) $partials['order']->getStatus(),
            products: self::lines($partials['order']),
            productsAggregate: array_map(static fn (array $line) => new PartialLineOutput($line['uuid'], (int) $line['quantity'], new PartialLineProductOutput($line['product']['code'])), $partials['aggregate']),
            pending: array_map(static fn (array $line) => new PendingLineOutput($line['uuid'], $line['quantity']), $partials['pending']),
            inventory: array_map(static fn (ProductWarehouse $row) => new StockOutput(
                id: (int) $row->getId(),
                status: (int) $row->getStatus(),
                quantity: (int) $row->getQuantity(),
                productId: (int) $row->getProduct()?->getId(),
                uuid: (string) $row->getProduct()?->getUuid(),
                code: (string) $row->getProduct()?->getCode(),
                title: (string) $row->getProduct()?->getTitle(),
                detail: $row->getProduct()?->getDetail(),
                price: $row->getProduct()?->getPrice(),
                warehouse: new WarehouseRefOutput((int) $row->getWarehouse()?->getId(), (string) $row->getWarehouse()?->getName()),
            ), $partials['inventory']),
        );
    }

    /**
     * @return list<OrderLineOutput>
     */
    private static function lines(Order $order): array
    {
        return array_map(static fn (OrderProduct $line) => new OrderLineOutput(
            $line->getUuid(),
            (int) $line->getQuantity(),
            new OrderLineProductOutput((string) $line->getProduct()?->getCode(), (string) $line->getProduct()?->getTitle(), $line->getProduct()?->getDetail()),
        ), $order->getOrderProducts()->getValues());
    }

    private static function warehouse(?Warehouse $warehouse): ?WarehouseRefOutput
    {
        return null === $warehouse ? null : new WarehouseRefOutput((int) $warehouse->getId(), (string) $warehouse->getName());
    }

    private static function customer(?Customer $customer): ?CustomerOutput
    {
        if (null === $customer) {
            return null;
        }

        return new CustomerOutput(
            (int) $customer->getId(),
            $customer->getFirstName(),
            $customer->getLastName(),
            $customer->getEmail(),
            $customer->getPhone(),
            array_map(static function (CustomerAddress $address): AddressOutput {
                $city = $address->getCity();
                $state = $city?->getState();
                $country = $state?->getCountry();

                return new AddressOutput(
                    (int) $address->getId(),
                    $address->getAddress(),
                    $address->getZipCode(),
                    $address->getAddressType(),
                    null === $city || null === $state || null === $country ? null : new CityRefOutput(
                        (int) $city->getId(),
                        (string) $city->getName(),
                        new StateRefOutput((int) $state->getId(), (string) $state->getName(), $state->getCode(), new CountryRefOutput((int) $country->getId(), (string) $country->getName(), $country->getCode())),
                    ),
                );
            }, $customer->getAddresses()->getValues()),
        );
    }
}
