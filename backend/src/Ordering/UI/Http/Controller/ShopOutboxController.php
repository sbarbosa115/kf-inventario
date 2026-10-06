<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\Application\Command\RetryShopUpdate;
use App\Ordering\Application\Query\ShopPushes;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Ordering\UI\Http\Output\OrderRefOutput;
use App\Ordering\UI\Http\Output\ShopOutboxOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\ApiValidationException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * What the app writes back to a shop and how it went (docs/pdr/prd-shops-settings.md, Decisions 10), for an admin:
 * the connection's outbox rows in a status, and Retry for one that failed.
 */
#[IsGranted('ROLE_ADMIN')]
final class ShopOutboxController extends AbstractController
{
    public function __construct(
        private readonly ShopPushes $pushes,
        private readonly CommandBus $commands,
    ) {
    }

    /**
     * The connection's writes in a status, newest first: `?status=` pending, sent or failed (the default: what the
     * health counts). 404 shop_not_found; 422 for another status.
     */
    #[Route('/api/v1/shops/{id}/outbox', name: 'api_shops_outbox', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopOutboxOutput::class, list: true)]
    public function list(int $id, Request $request): JsonResponse
    {
        $status = $request->query->getString('status', ShopOutbox::STATUS_FAILED);
        if (!\in_array($status, ShopPushes::STATUSES, true)) {
            throw ApiValidationException::single('status', 'The value you selected is not a valid choice.');
        }

        return $this->json(array_map(self::present(...), $this->pushes->of($id, $status)));
    }

    /**
     * Queues a write again, due now → the row as it is afterwards (pending; sent or failed once the queue has run
     * it). A row already sent is answered as it is. 404 shop_not_found / outbox_not_found (also another
     * connection's row).
     */
    #[Route('/api/v1/shops/{id}/outbox/{outboxId}/retry', name: 'api_shops_outbox_retry', methods: ['POST'], requirements: ['id' => '\d+', 'outboxId' => '\d+'])]
    #[ApiResponse(ShopOutboxOutput::class)]
    public function retry(int $id, int $outboxId): JsonResponse
    {
        $this->commands->dispatch(new RetryShopUpdate($id, $outboxId));

        return $this->json(self::present($this->pushes->get($id, $outboxId)));
    }

    private static function present(ShopOutbox $entry): ShopOutboxOutput
    {
        $order = $entry->order();

        return new ShopOutboxOutput(
            id: (int) $entry->id(),
            capability: $entry->capability()->value,
            order: new OrderRefOutput((int) $order->getId(), $order->getCode()),
            payload: $entry->payload(),
            status: $entry->status(),
            attempts: $entry->attempts(),
            lastError: $entry->lastError(),
            createdAt: $entry->createdAt()->format(\DATE_ATOM),
        );
    }
}
