<?php

namespace App\Controller;

use App\Entity\Product;
use App\Entity\Warehouse;
use App\Form\ProductType;
use App\Form\UploadProductsType;
use App\Repository\ProductRepository;
use App\Repository\ProductWarehouseRepository;
use App\Services\LogService;
use App\Services\ProductService;
use Doctrine\ORM\EntityManagerInterface;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @Route("/product", name="product_")
 * @IsGranted("ROLE_MANAGE_INVENTORY")
 */
class ProductController extends AbstractController
{
    /**
     * @Route("/", name="product_index", methods={"get"})
     */
    public function index(): Response
    {
        return $this->render('product/index.html.twig');
    }

    /**
     * @Route("/show/{code}", name="show", options={"expose"=true}, methods={"get"})
     */
    public function show(
        ProductRepository $productRepo,
        string $code
    ): Response {
        $product = $productRepo->findOneBy(['code' => $code]);

        if (!$product instanceof Product) {
            throw new NotFoundHttpException("No product with this code [{$code}] was found.");
        }

        $serializer = new Serializer([new ObjectNormalizer()], [new JsonEncoder()]);
        $data = $serializer->normalize($product, 'json', ['attributes' => [
            'uuid',
            'code',
            'productWarehouses' => ['quantity'],
        ]]);

        return new Response(json_encode($data), 200);
    }

    /**
     * @Route("/edit/{uuid}", name="update", methods={"get", "post"}, options={"expose"=true})
     */
    public function update(
        EntityManagerInterface $manager,
        Request $request,
        Product $product
    ): Response {
        $form = $this->createForm(ProductType::class, $product);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $manager->persist($product);
            $manager->flush();

            $this->addFlash('success', 'product.edit.updated_successfully');

            return $this->redirectToRoute('product_product_index');
        }

        return $this->render('product/edit.html.twig', [
            'form' => $form->createView(),
        ]);
    }

    /**
     * @Route("/new", name="new", methods={"get", "post"}, options={"expose"=true})
     */
    public function new(
        EntityManagerInterface $manager,
        Request $request
    ): Response {
        $product = new Product();
        $form = $this->createForm(ProductType::class, $product);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $manager->persist($product);
            $manager->flush();

            $this->addFlash('success', 'product.new.updated_successfully');

            return $this->redirectToRoute('product_product_index');
        }

        return $this->render('product/new.html.twig', [
            'form' => $form->createView(),
        ]);
    }

    /**
     * @Route("/upload", name="product_upload", methods={"get", "post"})
     */
    public function upload(
        TranslatorInterface $translator,
        Request $request,
        ProductService $productService
    ): Response {
        $form = $this->createForm(UploadProductsType::class);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $productService->processXls($form->getData());
            $this->addFlash('success', $translator->trans('product.uploaded_successfully'));

            return $this->redirectToRoute('product_product_index');
        }

        return $this->render('product/upload.html.twig', [
            'form' => $form->createView(),
        ]);
    }

    /**
     * @Route("/template/{all}", defaults={"all"=false}, name="template", methods={"get", "post"}, options={"expose"=true})
     */
    public function uploadProductsTemplate(
        ProductRepository $productRepo,
        TranslatorInterface $translator,
        Request $request,
        bool $all
    ): Response {
        $template = new Spreadsheet();
        $template->getActiveSheet()->setCellValue('A1', $translator->trans('product.template.code'));
        $template->getActiveSheet()->setCellValue('B1', $translator->trans('product.template.title'));
        $template->getActiveSheet()->setCellValue('C1', $translator->trans('product.template.detail'));
        $template->getActiveSheet()->setCellValue('D1', $translator->trans('product.template.quantity'));
        $template->getActiveSheet()->setCellValue('E1', $translator->trans('product.template.price'));

        $products = [];
        if ($all) {
            $products = $productRepo->findAll();
        } elseif ($request->get('data')) {
            $uuids = $request->get('data');
            $products = $productRepo->findByUuids($uuids);
        }
        if (\count($products) > 0) {
            $this->attachCell($template, $products);
        }

        $writer = new Xls($template);
        $response = new StreamedResponse(
            static function () use ($writer) {
                $writer->save('php://output');
            }
        );

        $response->headers->set('Content-Type', 'application/vnd.ms-excel');
        $response->headers->set('Content-Disposition', 'attachment;filename="'.$translator->trans('product.template.products').'.xls"');
        $response->headers->set('Cache-Control', 'max-age=0');

        return $response;
    }

    protected function attachCell(Spreadsheet $template, array $products): void
    {
        foreach ($products as $key => $product) {
            $row = $key + 2;
            $template->getActiveSheet()->setCellValue("A{$row}", $product->getCode());
            $template->getActiveSheet()->setCellValue("B{$row}", $product->getTitle());
            $template->getActiveSheet()->setCellValue("C{$row}", $product->getDetail());
            $template->getActiveSheet()->setCellValue("D{$row}", 0);
            $template->getActiveSheet()->setCellValue("E{$row}", 0);
        }
    }

    /**
     * @Route("/all/{warehouse}/{status}", name="all", options={"expose"=true}, defaults={"status"=1}, methods={"get"})
     */
    public function all(
        ProductWarehouseRepository $productWarehouseRepo,
        Warehouse $warehouse,
        int $status
    ): Response {
        $products = $productWarehouseRepo->findByWarehouse($warehouse, $status);

        return new JsonResponse($products);
    }

    /**
     * @Route("/move/{warehouseSource}/{warehouseDestination}", name="move", options={"expose"=true}, methods={"post"})
     */
    public function move(
        ProductService $productService,
        Request $request,
        Warehouse $warehouseSource,
        Warehouse $warehouseDestination,
        LogService $logService
    ): Response {
        $products = json_decode($request->getContent(), true);
        if (!\is_array($products)) {
            throw new BadRequestHttpException('Malformed JSON request');
        }

        $productService->moveProducts($products['data'], $warehouseSource, $warehouseDestination);
        $logService->add(
            'Product',
            "Moved products from {$warehouseSource->getName()} to {$warehouseDestination->getName()}",
            $products
        );

        return new JsonResponse(['status' => true]);
    }

    /**
     * @Route("/update/bar-code", name="bar_code", methods={"get"})
     */
    public function updateBarCode(): Response
    {
        return $this->render('product/bar-code.html.twig');
    }

    /**
     * @Route("/update/bar-code/{warehouse}/add", name="bar_code_add", options={"expose"=true}, methods={"post"})
     */
    public function addBarCode(
        ProductService $productService,
        Request $request,
        Warehouse $warehouse,
        LogService $logService
    ): Response {
        $products = json_decode($request->getContent(), true);
        if (!\is_array($products)) {
            throw new BadRequestHttpException('Malformed JSON request');
        }
        $productService->addProductsToInventory($products['data'], $warehouse);
        $logService->add(
            'Product',
            sprintf("Added %d products to {$warehouse->getName()}", \count($products['data'])),
            $products
        );

        return new JsonResponse(['status' => true]);
    }

    /**
     * @Route("/update/bar-code/{warehouse}/remove", name="bar_code_remove", options={"expose"=true}, methods={"post"})
     */
    public function removeBarCode(
        ProductService $productService,
        Request $request,
        Warehouse $warehouse,
        LogService $logService
    ): Response {
        $products = json_decode($request->getContent(), true);
        if (!\is_array($products)) {
            throw new BadRequestHttpException('Malformed JSON request');
        }
        $productService->removeProductsFromInventory($products['data'], $warehouse);
        $logService->add(
            'Product',
            sprintf("Removed %d products to {$warehouse->getName()}", \count($products['data'])),
            $products
        );

        return new JsonResponse(['status' => true]);
    }

    /**
     * @Route("/incoming", name="incoming", methods={"get"})
     */
    public function incoming(): Response
    {
        return $this->render('product/incoming.html.twig');
    }

    /**
     * @Route("/incoming/approve/{warehouse}", name="approve_incoming", methods={"post"}, options={"expose"=true})
     */
    public function approveIncoming(
        ProductService $productService,
        Warehouse $warehouse
    ): Response {
        $productService->approveProducts($warehouse, $productService);

        return new JsonResponse(['status' => true]);
    }
}
