<?php

namespace App\Ordering\UI\Http\Controller;

use App\Identity\Domain\Model\User;
use App\Ordering\Application\Command\AddOrderComment;
use App\Ordering\Application\Command\PinOrderComment;
use App\Ordering\Application\Command\UnpinOrderComment;
use App\Ordering\Application\Query\Orders;
use App\Ordering\UI\Http\Input\AddOrderCommentInput;
use App\Ordering\UI\Http\OrderPresenter;
use App\Ordering\UI\Http\Output\OrderCommentOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * An order's comment timeline (docs/pdr/prd-shops-settings.md, "API changes" › Comments): read, add (typed, a quick
 * phrase, also sent to the shop), pin. PUT /orders/{id}/comments stays in OrderController for the order form.
 */
final class OrderCommentController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly Orders $orders,
        private readonly InputMapper $inputs,
        private readonly OrderPresenter $presenter,
    ) {
    }

    /**
     * The order's comments, oldest first (on the same date, in the order they were written); a legacy comment
     * without a date carries the order's (`approximate`); shop notes (`origin` shop) name their shop and no author.
     * 404 order_not_found.
     */
    #[Route('/api/v1/orders/{id}/comments', name: 'api_order_comments', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    #[ApiResponse(OrderCommentOutput::class, list: true, key: 'comments')]
    public function list(int $id): JsonResponse
    {
        return $this->json(['comments' => $this->presenter->comments($this->orders->get($id))]);
    }

    /**
     * AddOrderCommentInput → 201 the comment (signed by you, dated now; `origin` phrase with an active `phrase_id`).
     * 422 shop_note_unavailable when `send_to_shop` cannot be done (the order is not from a connection, or the
     * connection is inactive or its order_note capability is off): nothing is written. 404 order_not_found,
     * quick_phrase_not_found.
     */
    #[Route('/api/v1/orders/{id}/comments', name: 'api_order_comments_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class, status: 201)]
    public function add(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), AddOrderCommentInput::class);

        $commentId = $this->commands->dispatch(new AddOrderComment($id, $this->currentUser()->getId() ?? 0, $input->content, $input->sendToShop, $input->phraseId));
        if (!\is_int($commentId)) {
            throw new \LogicException('AddOrderCommentHandler answers the new comment\'s id.');
        }

        return $this->json($this->presenter->commentOf($this->orders->get($id), $commentId), 201);
    }

    /**
     * Pins the comment (the order's only pinned one: the previous one is unpinned). 404 order_not_found,
     * comment_not_found (also for another order's comment).
     */
    #[Route('/api/v1/orders/{id}/comments/{commentId}/pin', name: 'api_order_comments_pin', methods: ['POST'], requirements: ['id' => '\d+', 'commentId' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class)]
    public function pin(int $id, int $commentId): JsonResponse
    {
        $this->commands->dispatch(new PinOrderComment($id, $commentId, $this->currentUser()->getId() ?? 0));

        return $this->json($this->presenter->commentOf($this->orders->get($id), $commentId));
    }

    /**
     * Unpins it (a comment that is not pinned is left as it is). 404 order_not_found, comment_not_found.
     */
    #[Route('/api/v1/orders/{id}/comments/{commentId}/pin', name: 'api_order_comments_unpin', methods: ['DELETE'], requirements: ['id' => '\d+', 'commentId' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class)]
    public function unpin(int $id, int $commentId): JsonResponse
    {
        $this->commands->dispatch(new UnpinOrderComment($id, $commentId));

        return $this->json($this->presenter->commentOf($this->orders->get($id), $commentId));
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
