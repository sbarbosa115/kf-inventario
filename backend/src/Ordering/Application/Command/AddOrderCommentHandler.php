<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\CommentAuthors;
use App\Ordering\Application\Port\ShopOutboxQueue;
use App\Ordering\Domain\Error\CommentPhraseNotFound;
use App\Ordering\Domain\Error\EmptyComment;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Error\ShopNoteUnavailable;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;
use App\Ordering\Domain\Repository\ShopOutboxRepository;
use App\Settings\Application\Query\QuickPhrases;
use App\Settings\Application\Query\QuickPhraseView;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/**
 * A comment from the timeline: a `comment` row signed by its author and dated now, plus its metadata row (origin
 * `app`, or `phrase` for an active quick phrase). "Also send to the shop" is checked first — the order must come
 * from an active connection whose order_note capability is on — and writes an `order_note` outbox row that the
 * `shops` queue pushes (item 5b); the comment never waits for the shop.
 */
final class AddOrderCommentHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly CommentAuthors $authors,
        private readonly CommentMetaRepository $metas,
        private readonly ShopOrderLinkRepository $links,
        private readonly ShopOutboxRepository $outbox,
        private readonly QuickPhrases $phrases,
        private readonly Clock $clock,
        // The `shops` queue's adapter is item 5b's (PushShopUpdate); until it exists the row waits, pending, for it.
        private readonly ?ShopOutboxQueue $queue = null,
    ) {
    }

    /**
     * @return int the new comment's id
     *
     * @throws OrderNotFound|EmptyComment|CommentPhraseNotFound|ShopNoteUnavailable
     */
    public function __invoke(AddOrderComment $command): int
    {
        $order = $this->orders->get($command->orderId);
        if ('' === trim($command->content)) {
            throw new EmptyComment();
        }
        if (null !== $command->phraseId && !$this->isActivePhrase($command->phraseId)) {
            throw new CommentPhraseNotFound();
        }
        $shop = $command->sendToShop ? $this->shopTakingNotes($command->orderId) : null;

        $now = $this->clock->now();
        $comment = new Comment();
        $comment->setCreatedAt(\DateTime::createFromImmutable($now));
        $comment->setUser($this->authors->get($command->authorId));
        $comment->setContent($command->content);
        $order->addComment($comment);
        $this->orders->addComment($comment);
        // The metadata row's key is the comment's id (a derived identity): the comment is written first.
        $this->orders->identify($order);
        $commentId = (int) $comment->getId();

        $this->metas->add(new OrderCommentMeta($comment, null === $command->phraseId ? OrderCommentMeta::ORIGIN_APP : OrderCommentMeta::ORIGIN_PHRASE, sendToShop: null !== $shop));
        if (null === $shop) {
            return $commentId;
        }

        $entry = new ShopOutbox($shop, $order, ShopCapability::OrderNote, ['comment_id' => $commentId, 'note' => $command->content], $now);
        $this->outbox->add($entry);
        $this->orders->identify($order);
        $this->queue?->enqueue((int) $entry->id());

        return $commentId;
    }

    /**
     * @throws ShopNoteUnavailable
     */
    private function shopTakingNotes(int $orderId): ShopConnection
    {
        $connection = $this->links->ofOrder($orderId)?->connection();
        if (null === $connection || !$connection->isActive() || !$connection->can(ShopCapability::OrderNote)) {
            throw new ShopNoteUnavailable();
        }

        return $connection;
    }

    private function isActivePhrase(int $phraseId): bool
    {
        return [] !== array_filter($this->phrases->list(), static fn (QuickPhraseView $p): bool => $p->id === $phraseId);
    }
}
