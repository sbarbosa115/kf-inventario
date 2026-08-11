<?php

namespace App\Controller;

use App\DataProviders\WooCommerceProvider;
use App\Entity\Order;
use App\Entity\OrderProduct;
use App\Entity\Product;
use App\Entity\Warehouse;
use App\Model\RemoveOrderInput;
use App\Repository\CountryRepository;
use App\Repository\CustomerRepository;
use App\Repository\OrderRepository;
use App\Repository\ProductWarehouseRepository;
use App\Repository\WarehouseRepository;
use App\Services\CommentService;
use App\Services\LogService;
use App\Services\NotificationService;
use App\Services\OrderService;
use App\Services\PdfHandlerService;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use LogicException;
use PhpOffice\PhpSpreadsheet\Exception;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\Exception\ExceptionInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/order', name: 'order_')]
class OrderController extends AbstractController
{
    #[Route('/', name: 'index', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function index(): Response
    {
        return $this->render('order/index.html.twig');
    }

    #[Route('/new', name: 'new', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_CREATE_ORDERS')]
    public function new(
        CountryRepository $countryRepo,
        WarehouseRepository $warehouseRepo,
        CustomerRepository $customerRepo
    ): Response {
        $locations = $countryRepo->findAllAsArray();

        if (is_array($locations) && count($locations) > 1000) {
            $locations = array_slice($locations, 0, 100);
        }

        return $this->render('order/new.html.twig', [
            'url' => $this->generateUrl('order_create'),
            'locations' => $locations,
            'warehouses' => $warehouseRepo->findAllAsArray(),
            'customers' => $customerRepo->findAllAsArray(),
        ]);
    }

    /**
     * @throws ExceptionInterface
     */
    #[Route('/create', name: 'create', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_CREATE_ORDERS')]
    public function create(
        Request $request,
        OrderService $orderService,
        LogService $logService,
        NotificationService $notificationService,
        OrderRepository $orderRepository
    ): JsonResponse {
        $orderData = json_decode($request->getContent(), true);
        $orderModel = $orderService->add($orderData, $this->getUser());
        try {
            $notificationService->sendOrderByEmail($orderRepository->find($orderModel['id']));
        } catch (\Throwable $e) {
            $logService->add('Mail', sprintf('Failed to send order email for order %s: %s', $orderModel['id'] ?? 'n/a', $e->getMessage()));
        }

        $logService->add('Order', 'Order created', $orderModel);

        return new JsonResponse([
            'status' => true,
            'route' => $this->generateUrl('order_index'),
            'order' => $orderModel['id'],
        ]);
    }

    /**
     * @throws ExceptionInterface
     */
    #[Route('/edit/{order}', name: 'edit', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_UPDATE_ORDERS')]
    public function edit(
        CountryRepository $countryRepo,
        WarehouseRepository $warehouseRepo,
        CustomerRepository $customerRepo,
        OrderService $orderService,
        Order $order
    ): Response {
        $locations = $countryRepo->findAllAsArray();

        if (is_array($locations) && count($locations) > 1000) {
            $locations = array_slice($locations, 0, 100);
        }

        return $this->render('order/edit.html.twig', [
            'url' => $this->generateUrl('order_update', [
                'order' => $order->getId(),
            ]),
            'order' => $orderService->getOrderAsArray($order),
            'locations' => $locations,
            'warehouses' => $warehouseRepo->findAllAsArray(),
            'customers' => $customerRepo->findAllAsArray(),
        ]);
    }

    /**
     * @throws ExceptionInterface
     */
    #[Route('/update/{order}', methods: ['POST'], name: 'update')]
    #[IsGranted('ROLE_CAN_UPDATE_ORDERS')]
    public function update(
        Request $request,
        OrderService $orderService,
        LogService $logService,
        Order $order
    ): JsonResponse {
        $orderData = json_decode($request->getContent(), true);
        $orderService->update($order, $orderData);
        $logService->add('Order', 'Order updated', $orderData);

        return new JsonResponse(['status' => true, 'route' => $this->generateUrl('order_index')]);
    }

    #[Route('/all/{warehouse}', name: 'all', options: ['expose' => true], defaults: ['status' => 1], methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function all(
        OrderRepository $orderRepo,
        Warehouse $warehouse
    ): JsonResponse {
        $products = $orderRepo->findByWarehouse($warehouse);

        return new JsonResponse($products);
    }

    /**
     * @throws ExceptionInterface
     */
    #[Route('/detail/{order}', name: 'detail', options: ['expose' => true], methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function detail(
        Order $order,
        OrderService $orderService
    ): Response {
        $result = $orderService->getOrderAsArray($order);
        $response = new Response(json_encode($result));
        $response->headers->set('Content-Type', 'application/json');

        return $response;
    }

    #[Route('/sync-comments/{order}', name: 'sync_comments', options: ['expose' => true], methods: ['POST'])]
    public function syncComments(
        Order $order,
        CommentService $commentService,
        Request $request
    ): Response {
        $user = $this->getUser();
        $content = json_decode($request->getContent(), true);

        if (!\is_array($content)) {
            throw new LogicException('Invalid content request format.');
        }

        $commentService->syncComments($content['comments'], $user, $order);
        $response = new Response(json_encode($commentService->getOrderComments($order)));
        $response->headers->set('Content-Type', 'application/json');

        return $response;
    }

    #[Route('/pdf/{order}', name: 'pdf', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function pdf(
        Order $order,
        PdfHandlerService $pdfHandlerService
    ): Response {
        $html = $this->renderView('order/pdf.html.twig', [
            'order' => $order,
        ]);

        $response = new Response();
        $response->setContent($pdfHandlerService->createPdf($html));
        $response->setStatusCode(200);
        $response->headers->set('Content-Type', 'application/pdf');

        return $response;
    }

    #[Route('/pdf/remaining/{order}', name: 'pdf_remaining', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function remainingProductsPdf(
        Order $order,
        PdfHandlerService $pdfHandlerService
    ): Response {
        $html = $this->renderView('order/remaining-pdf.html.twig', [
            'order' => $order,
        ]);

        $response = new Response();
        $response->setContent($pdfHandlerService->createPdf($html));
        $response->setStatusCode(200);
        $response->headers->set('Content-Type', 'application/pdf');

        return $response;
    }

    #[Route('/edit/status/{order}/{status}', name: 'change_status', methods: ['POST'], options: ['expose' => true])]
    #[IsGranted('ROLE_UPDATE_ORDERS')]
    public function changeStatus(
        Order $order,
        int $status,
        EntityManagerInterface $manager,
        LogService $logService
    ): Response {
        $order->setStatus($status);
        $manager->persist($order);
        $manager->flush();

        $logService->add('Order', "Order {$order->getCode()} status was changed.");

        return new JsonResponse(['status' => true]);
    }

    #[Route('/sync', name: 'sync_orders', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_SYNC_ORDERS')]
    public function syncRemoteOrders(
        WooCommerceProvider $woocommerceProvider
    ): Response {
        $woocommerceProvider->syncOrders($this->getUser());

        return new JsonResponse(['status' => true]);
    }

    #[Route('/delete', name: 'delete', options: ['expose' => true], methods: ['DELETE'])]
    #[IsGranted('ROLE_CAN_DELETE_ORDERS')]
    public function delete(
        Request $request,
        OrderService $orderService,
        ValidatorInterface $validator,
        LogService $logService
    ): Response {
        $inputModel = RemoveOrderInput::createFormInput(json_decode($request->getContent(), true));
        if (0 !== $validator->validate($inputModel)->count()) {
            throw new InvalidArgumentException('The request is malformed.');
        }

        if (!$this->isCsrfTokenValid('delete-order', $inputModel->token)) {
            throw new LogicException('Token does not math with the expected one.');
        }

        $logService->add('Order', "Order {$inputModel->order} was deleted");
        $orderService->deleteOrderById($inputModel->order);

        return new JsonResponse(['status' => true]);
    }

    #[Route('/partial/getting-ready/{order}', name: 'getting_ready', methods: ['GET'], options: ['expose' => true])]
    public function gettingReady(
        Order $order,
        OrderService $orderService,
        ProductWarehouseRepository $productWarehouseRepo
    ): Response {
        return $this->render('order/getting-ready.html.twig', [
            'order' => $orderService->getOrderAsArray($order),
            'partials' => $order->getAggregatePartials(),
            'inventory' => $productWarehouseRepo->getOrderProductsOnInventoryAsArray($order),
        ]);
    }

    #[Route('/partial/{order}', methods: ['GET'])]
    public function getPartials(Order $order): Response
    {
        return new JsonResponse([
            'order' => $order->getId(),
            'productsAggregate' => $order->getAggregatePartials(),
            'pendingOrderProductQuantities' => $order->getPendingOrderProductsQuantities(),
        ]);
    }

    #[Route('/partial/{order}', name: 'partial', methods: ['POST'], options: ['expose' => true])]
    public function partial(
        Request $request,
        OrderService $orderService,
        Order $order
    ): JsonResponse {
        $partialOrderData = json_decode($request->getContent(), true);
        $orderService->createPartial($order, $partialOrderData);

        return new JsonResponse([
            'order' => $order->getId(),
            'productsAggregate' => $order->getAggregatePartials(),
            'pendingOrderProductQuantities' => $order->getPendingOrderProductsQuantities(),
        ]);
    }

    /**
     * @throws Exception
     */
    #[Route('/xls/{order}', name: 'xls', methods: ['GET'], options: ['expose' => true])]
    public function uploadProductsTemplate(
        Order $order,
        TranslatorInterface $translator
    ): Response {
        $template = new Spreadsheet();
        $template->getActiveSheet()->setCellValue('A1', $translator->trans('order.xls.date'));
        $template->getActiveSheet()->setCellValue('B1', $translator->trans('order.xls.productCode'));
        $template->getActiveSheet()->setCellValue('C1', $translator->trans('order.xls.quantity'));

        $products = $order->getOrderProducts();
        $line = 2;
        foreach ($products as $product) {
            if (!$product->getProduct() instanceof Product) {
                throw new InvalidArgumentException('Product not found.');
            }
            if (!$order->getCreatedAt() instanceof \DateTimeInterface) {
                throw new InvalidArgumentException('Datetime is missing.');
            }

            $template->getActiveSheet()->setCellValue("A{$line}", $order->getCreatedAt()->format('Y-m-d'));
            $template->getActiveSheet()->setCellValue("B{$line}", $product->getProduct()->getCode());
            $template->getActiveSheet()->setCellValue("C{$line}", $product->getQuantity());
            ++$line;
        }

        $writer = new Xls($template);
        $response = new StreamedResponse(
            static function () use ($writer) {
                $writer->save('php://output');
            }
        );

        $filename = "{$translator->trans('product.xls.filename')}-{$order->getCode()}";
        $response->headers->set('Content-Type', 'application/vnd.ms-excel');
        $response->headers->set('Content-Disposition', 'attachment;filename="'.$filename.'.xls"');
        $response->headers->set('Cache-Control', 'max-age=0');

        return $response;
    }

    #[Route('/1H39j0jpQPsWL958v9R4', name: 'create_webhook', methods: ['POST', 'GET'], options: ['expose' => true])]
    public function createWebhook(
        Request $request,
        LoggerInterface $logger,
        WooCommerceProvider $commerceProvider,
        OrderService $orderService,
        WarehouseRepository $warehouseRepo,
        NotificationService $notificationService,
        OrderRepository $orderRepo
    ): Response {
        $content = $request->getContent();
        $source = $request->headers->get('X-WC-Webhook-Source');

        $warehouses = $warehouseRepo->findAll();
        $warehouse = null;

        foreach ($warehouses as $warehouseItem) {
            if (in_array($source, $warehouseItem->getUrls())) {
                $warehouse = $warehouseItem;
            }
        }

        if ($warehouse instanceof Warehouse) {
            $order = $commerceProvider->transformOrder(json_decode($content));
            $order['warehouse'] = ['name' => $warehouse->getName(), 'id' => $warehouse->getId()];
            $orderModel = $orderService->add($order);

            if ($warehouse->getId() === 1) {
                try {
                    $notificationService->sendOrderByEmail($orderRepo->find($orderModel['id']));
                } catch (\Throwable $e) {
                    $logger->error(sprintf('Failed to send order email for webhook order %s: %s', $orderModel['id'] ?? 'n/a', $e->getMessage()));
                }
            }
        } else {
            $logger->error(sprintf('Warehouse [%s] was not found', $source));
        }

        return new JsonResponse(['status' => true]);
    }

}
