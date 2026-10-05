<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\Application\Command\ImportShopOrder;
use App\Shared\Application\Command\CommandBus;
use App\Shared\Domain\Error\DomainError;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The WooCommerce webhook: the shops post each new order here. The URL and the route name are the legacy ones (the
 * shops are configured with it): public (security.yaml), outside /api/ and the SPA. The shop always gets
 * {status: true}; what could not be placed is logged.
 */
final class WooCommerceWebhookController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/admin/order/1H39j0jpQPsWL958v9R4', name: 'order_create_webhook', methods: ['POST', 'GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $source = $request->headers->get('X-WC-Webhook-Source');
        $shopOrder = json_decode($request->getContent(), true);

        try {
            $this->commands->dispatch(new ImportShopOrder($source, \is_array($shopOrder) ? $shopOrder : []));
        } catch (DomainError|\UnexpectedValueException $e) {
            $this->logger->error(\sprintf('WooCommerce order from [%s] was not placed: %s', $source, $e->getMessage()), ['exception' => $e]);
        }

        return new JsonResponse(['status' => true]);
    }
}
