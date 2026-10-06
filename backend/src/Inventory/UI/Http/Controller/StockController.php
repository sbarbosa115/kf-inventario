<?php

namespace App\Inventory\UI\Http\Controller;

use App\Inventory\Application\Command\AddStock;
use App\Inventory\Application\Command\ApproveIncoming;
use App\Inventory\Application\Command\MoveStock;
use App\Inventory\Application\Command\RemoveStock;
use App\Inventory\Application\Command\StockLine;
use App\Inventory\Application\Query\Stock;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\UI\Http\Input\StockLineInput;
use App\Inventory\UI\Http\Input\StockLinesInput;
use App\Inventory\UI\Http\Output\ApprovedOutput;
use App\Inventory\UI\Http\Output\StockOutput;
use App\Inventory\UI\Http\Output\StockTotalsOutput;
use App\Inventory\UI\Http\Output\WarehouseRefOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\Application\Query\ListField;
use App\Shared\Application\Query\ListSchema;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use App\Shared\UI\Http\ListQueryParser;
use App\Shared\UI\Http\Output\PageOutput;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * A warehouse's stock: the lists, moves between warehouses, the barcode reader and the incoming approval.
 */
final class StockController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $bus,
        private readonly InputMapper $inputs,
        private readonly Stock $stock,
        private readonly ListQueryParser $lists,
    ) {
    }

    /** The stock list's contract (docs/pdr/prd-shops-settings.md, "List query contract"); per_page=0 for the pickers. */
    public static function listSchema(): ListSchema
    {
        return new ListSchema(
            fields: [
                'code' => ListField::text(),
                'title' => ListField::text(),
                'detail' => ListField::text(),
                'quantity' => ListField::number(),
                'price' => ListField::number(),
                'in_stock' => ListField::enum(['yes', 'no']),
            ],
            sorts: ['code', 'title', 'quantity', 'price'],
            defaultSort: 'code',
            allowAll: true,
        );
    }

    /**
     * A page of the warehouse's stock rows with `status` (1 in stock, default; 0 incoming): the list contract (q over
     * code, title and detail; filters code, title, detail, quantity, price, in_stock; sorts code, title, quantity,
     * price; `per_page=0` every row, for the pickers) and `totals` (units, value) over every row the filters keep.
     * 404 warehouse_not_found.
     */
    #[Route('/api/v1/warehouses/{id}/stock', name: 'api_stock_list', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(StockOutput::class, page: true, totals: StockTotalsOutput::class)]
    public function list(int $id, Request $request): JsonResponse
    {
        $status = $request->query->getInt('status', ProductWarehouse::STATUS_CONFIRMED);
        $query = $this->lists->parse($request, self::listSchema());

        $page = $this->stock->page($id, $status, $query);
        $totals = $this->stock->totals($id, $status, $query);

        return $this->json(PageOutput::of($page, $query, self::output(...), new StockTotalsOutput($totals['units'], $totals['value'])));
    }

    /**
     * StockLinesInput: moves quantities to another warehouse (they arrive as incoming). 204; 409 same_warehouse;
     * 404 product_not_found, stock_not_found, warehouse_not_found; 422 insufficient_stock (detail: code, available).
     */
    #[Route('/api/v1/warehouses/{from}/moves/{to}', name: 'api_stock_move', methods: ['POST'], requirements: ['from' => '\d+', 'to' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function move(int $from, int $to, Request $request): Response
    {
        $this->bus->dispatch(new MoveStock($from, $to, $this->lines($request)));

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * StockLinesInput (by code): the barcode reader adds stock; an unknown code is skipped. 204.
     */
    #[Route('/api/v1/warehouses/{id}/stock/add', name: 'api_stock_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function add(int $id, Request $request): Response
    {
        $this->bus->dispatch(new AddStock($id, $this->lines($request)));

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * StockLinesInput (by code): the barcode reader removes stock; an unknown code is skipped. 204; 404 stock_not_found;
     * 422 insufficient_stock (detail: code, available).
     */
    #[Route('/api/v1/warehouses/{id}/stock/remove', name: 'api_stock_remove', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function remove(int $id, Request $request): Response
    {
        $this->bus->dispatch(new RemoveStock($id, $this->lines($request)));

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Approves every incoming row of the warehouse. 404 warehouse_not_found.
     */
    #[Route('/api/v1/warehouses/{id}/incoming/approve', name: 'api_stock_approve_incoming', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ApprovedOutput::class)]
    public function approveIncoming(int $id): JsonResponse
    {
        $approved = $this->bus->dispatch(new ApproveIncoming($id));
        \assert(\is_int($approved));

        return $this->json(new ApprovedOutput($approved));
    }

    /**
     * @return list<StockLine>
     */
    private function lines(Request $request): array
    {
        $input = $this->inputs->map($this->inputs->json($request), StockLinesInput::class);

        return array_map(static fn (StockLineInput $line): StockLine => new StockLine(self::blankToNull($line->uuid), self::blankToNull($line->code), $line->quantity), $input->items);
    }

    private static function blankToNull(?string $value): ?string
    {
        return '' === $value ? null : $value;
    }

    private static function output(ProductWarehouse $row): StockOutput
    {
        $product = $row->getProduct();
        $warehouse = $row->getWarehouse();
        \assert($product instanceof Product && $warehouse instanceof Warehouse);

        return new StockOutput(
            id: (int) $row->getId(),
            status: (int) $row->getStatus(),
            quantity: (int) $row->getQuantity(),
            productId: (int) $product->getId(),
            uuid: (string) $product->getUuid(),
            code: (string) $product->getCode(),
            title: (string) $product->getTitle(),
            detail: $product->getDetail(),
            price: $product->getPrice(),
            warehouse: new WarehouseRefOutput((int) $warehouse->getId(), (string) $warehouse->getName()),
        );
    }
}
