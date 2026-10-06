<?php

namespace App\Inventory\UI\Http\Controller;

use App\Inventory\Application\Command\CreateProduct;
use App\Inventory\Application\Command\UpdateProduct;
use App\Inventory\Application\Command\UploadProducts;
use App\Inventory\Application\Port\ProductTemplateWriter;
use App\Inventory\Application\Query\Products;
use App\Inventory\Domain\Error\UnsupportedSpreadsheet;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\UI\Http\Input\ProductInput;
use App\Inventory\UI\Http\Output\ProductOutput;
use App\Inventory\UI\Http\Output\ProductStockOutput;
use App\Inventory\UI\Http\Output\UploadResultOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\ApiValidationException;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The products: by code (the barcode reader) and uuid, created and edited, and the stock spreadsheet.
 */
final class ProductController extends AbstractController
{
    /** The legacy UploadProductsType's list, checked on the file's content. */
    private const SPREADSHEET_TYPES = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    ];

    public function __construct(
        private readonly CommandBus $bus,
        private readonly InputMapper $inputs,
        private readonly Products $products,
    ) {
    }

    /**
     * A product by its code (the barcode reader). 404 product_not_found.
     */
    #[Route('/api/v1/products/by-code/{code}', name: 'api_products_by_code', methods: ['GET'], requirements: ['code' => '[^/]+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class)]
    public function byCode(string $code): JsonResponse
    {
        return $this->json(self::output($this->products->byCode($code)));
    }

    /**
     * A product by uuid. 404 product_not_found.
     */
    #[Route('/api/v1/products/{uuid}', name: 'api_products_show', methods: ['GET'], requirements: ['uuid' => '[0-9a-f-]{36}'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class)]
    public function show(string $uuid): JsonResponse
    {
        return $this->json(self::output($this->products->byUuid($uuid)));
    }

    /**
     * ProductInput: creates a product (no stock until some is uploaded, scanned or moved).
     */
    #[Route('/api/v1/products', name: 'api_products_create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), ProductInput::class);

        $uuid = $this->bus->dispatch(new CreateProduct($input->code, $input->title, $input->detail, $input->status, self::price($input)));
        \assert(\is_string($uuid));

        return $this->json(self::output($this->products->byUuid($uuid)), Response::HTTP_CREATED);
    }

    /**
     * ProductInput: edits a product. 404 product_not_found.
     */
    #[Route('/api/v1/products/{uuid}', name: 'api_products_update', methods: ['PUT'], requirements: ['uuid' => '[0-9a-f-]{36}'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class)]
    public function update(string $uuid, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), ProductInput::class);

        $this->bus->dispatch(new UpdateProduct($uuid, $input->code, $input->title, $input->detail, $input->status, self::price($input)));

        return $this->json(self::output($this->products->byUuid($uuid)));
    }

    /**
     * multipart: `file` (xls/xlsx, the template's columns) and `warehouse_id`: the products are created or updated and
     * their quantities added to the warehouse's stock. 404 warehouse_not_found; 415 unsupported_media; 422
     * invalid_spreadsheet.
     */
    #[Route('/api/v1/products/upload', name: 'api_products_upload', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(UploadResultOutput::class)]
    public function upload(Request $request): JsonResponse
    {
        $file = $request->files->get('file');
        $warehouseId = $this->inputs->form($request)['warehouse_id'] ?? null;

        $violations = [];
        if (!$file instanceof UploadedFile || !$file->isValid()) {
            $violations[] = ['field' => 'file', 'message' => 'This value should not be blank.'];
        }
        if (!\is_string($warehouseId) || !ctype_digit($warehouseId)) {
            $violations[] = ['field' => 'warehouse_id', 'message' => 'This value should not be blank.'];
        }
        if ([] !== $violations) {
            throw new ApiValidationException($violations);
        }
        \assert($file instanceof UploadedFile && \is_string($warehouseId));
        if (!\in_array($file->getMimeType(), self::SPREADSHEET_TYPES, true)) {
            throw new UnsupportedSpreadsheet();
        }

        $stored = $this->bus->dispatch(new UploadProducts($file->getPathname(), (int) $warehouseId));
        \assert(\is_int($stored));

        return $this->json(new UploadResultOutput($stored));
    }

    /**
     * The stock spreadsheet (an xls attachment): `all=1` for every product, or `uuid[]=…` for the selected ones; with
     * neither, the header alone.
     */
    #[Route('/api/v1/products/template.xls', name: 'api_products_template', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function template(Request $request, ProductTemplateWriter $writer, TranslatorInterface $translator): Response
    {
        $uuids = array_values(array_filter($request->query->all('uuid'), \is_string(...)));
        $products = $this->products->forTemplate($request->query->getBoolean('all'), $uuids);

        return new Response($writer->write($products), Response::HTTP_OK, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => 'attachment;filename="'.$translator->trans('product.template.products').'.xls"',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    private static function price(ProductInput $input): ?float
    {
        return null === $input->price ? null : (float) $input->price;
    }

    private static function output(Product $product): ProductOutput
    {
        return new ProductOutput(
            id: (int) $product->getId(),
            uuid: (string) $product->getUuid(),
            code: (string) $product->getCode(),
            title: (string) $product->getTitle(),
            detail: $product->getDetail(),
            status: (int) $product->getStatus(),
            price: $product->getPrice(),
            stock: array_values(array_map(
                static fn (ProductWarehouse $row): ProductStockOutput => new ProductStockOutput((int) $row->getWarehouse()?->getId(), (int) $row->getQuantity(), (int) $row->getStatus()),
                $product->getProductWarehouses()->toArray(),
            )),
        );
    }
}
