<?php

namespace App\Tests\Functional\Inventory;

use App\Inventory\Domain\Error\InvalidSpreadsheet;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Infrastructure\Spreadsheet\PhpSpreadsheetProductSheetReader;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx as XlsxWriter;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Products: by code (the barcode reader), by uuid, created and edited (the legacy ProductType's rules), the stock
 * spreadsheet downloaded and uploaded (ProductService::storeProducts, ported from ProductServiceTest).
 */
final class ProductApiTest extends ApiTestCase
{
    use InventoryFixtures;
    use SignsIn;

    /** @var list<string> */
    private array $files = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_USER', 'ROLE_MANAGE_INVENTORY']);
    }

    protected function tearDown(): void
    {
        foreach ($this->files as $file) {
            @unlink($file);
        }
        parent::tearDown();
    }

    public function testAProductIsFoundByItsCodeWithItsStock(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $product = $this->aProduct('KF-01', 'Chair', 12.5, 'Oak');
        $this->aStock($product, $colombia, 100);
        $this->aStock($product, $usa, 4, ProductWarehouse::STATUS_PENDING_TO_CONFIRM);
        $this->em()->clear();

        $body = $this->getJson('/api/v1/products/by-code/KF-01');

        $this->assertStatus(200);
        self::assertSame([
            'id' => $product->getId(),
            'uuid' => $product->getUuid(),
            'code' => 'KF-01',
            'title' => 'Chair',
            'detail' => 'Oak',
            'status' => 1,
            'price' => 12.5,
            'stock' => [
                ['warehouse_id' => $colombia->getId(), 'quantity' => 100, 'status' => 1],
                ['warehouse_id' => $usa->getId(), 'quantity' => 4, 'status' => 0],
            ],
        ], $body, 'The barcode reader reads the product and its quantity per warehouse.');
    }

    public function testAnUnknownCodeIsNotFound(): void
    {
        $body = $this->getJson('/api/v1/products/by-code/NOPE');

        $this->assertStatus(404);
        self::assertSame('product_not_found', $body['error'], 'The barcode reader tells an unknown code apart.');
    }

    public function testAProductIsFoundByItsUuid(): void
    {
        $product = $this->aProduct('KF-01');

        $body = $this->getJson("/api/v1/products/{$product->getUuid()}");

        $this->assertStatus(200);
        self::assertSame('KF-01', $body['code']);
        self::assertSame([], $body['stock']);
    }

    public function testAnUnknownUuidIsNotFound(): void
    {
        $body = $this->getJson('/api/v1/products/00000000-0000-0000-0000-000000000000');

        $this->assertStatus(404);
        self::assertSame('product_not_found', $body['error']);
    }

    public function testAProductIsCreated(): void
    {
        $body = $this->sendJson('POST', '/api/v1/products', ['code' => 'KF-NEW', 'title' => 'Table', 'detail' => 'Pine', 'status' => 0, 'price' => 99.9]);

        $this->assertStatus(201);
        self::assertSame(['KF-NEW', 'Table', 'Pine', 0, 99.9, []], [$body['code'], $body['title'], $body['detail'], $body['status'], $body['price'], $body['stock']]);
        self::assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $body['uuid'], 'A new product gets its uuid when saved, as before.');
        $this->em()->clear();
        $saved = $this->em()->getRepository(Product::class)->findOneBy(['code' => 'KF-NEW']);
        self::assertInstanceOf(Product::class, $saved);
        self::assertSame($body['id'], $saved->getId());
    }

    public function testAProductWithoutPriceCostsNothing(): void
    {
        $body = $this->sendJson('POST', '/api/v1/products', ['code' => 'KF-NEW', 'title' => 'Table']);

        $this->assertStatus(201);
        self::assertSame(0.0, (float) $body['price'], 'Product::setPrice(null) stores 0, as the legacy form did.');
        self::assertSame(1, $body['status'], 'Active unless said otherwise.');
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string}>
     */
    public static function refusedProducts(): iterable
    {
        yield 'no code' => [['code' => '', 'title' => 'Table'], 'code'];
        yield 'the template header as code' => [['code' => 'CODE', 'title' => 'Table'], 'code'];
        yield 'a dot as code' => [['code' => '·', 'title' => 'Table'], 'code'];
        yield 'the template header as title' => [['code' => 'KF-1', 'title' => 'PRODUCT'], 'title'];
        yield 'no title' => [['code' => 'KF-1', 'title' => ''], 'title'];
        yield 'an unknown status' => [['code' => 'KF-1', 'title' => 'Table', 'status' => 2], 'status'];
        yield 'a negative price' => [['code' => 'KF-1', 'title' => 'Table', 'price' => -1], 'price'];
    }

    /**
     * @param array<string, mixed> $payload
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('refusedProducts')]
    public function testAProductBreakingTheFormRulesIsRefused(array $payload, string $field): void
    {
        $body = $this->sendJson('POST', '/api/v1/products', $payload);

        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);
        self::assertContains($field, array_column($body['violations'], 'field'), "The rule is on {$field}.");
    }

    public function testAProductIsEdited(): void
    {
        $product = $this->aProduct('KF-01', 'Chair', 10.0);

        $body = $this->sendJson('PUT', "/api/v1/products/{$product->getUuid()}", ['code' => 'KF-01B', 'title' => 'Armchair', 'detail' => 'Leather', 'status' => 0, 'price' => 30]);

        $this->assertStatus(200);
        self::assertSame(['KF-01B', 'Armchair', 'Leather', 0, 30.0], [$body['code'], $body['title'], $body['detail'], $body['status'], (float) $body['price']]);
        self::assertSame($product->getUuid(), $body['uuid'], 'Editing keeps the uuid.');
        $this->em()->clear();
        self::assertSame('Armchair', $this->em()->find(Product::class, $product->getId())?->getTitle());
    }

    public function testEditingKeepsTheFormRules(): void
    {
        $product = $this->aProduct('KF-01');

        $body = $this->sendJson('PUT', "/api/v1/products/{$product->getUuid()}", ['code' => 'CODE', 'title' => 'Chair']);

        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);
    }

    public function testEditingAnUnknownProductIsNotFound(): void
    {
        $body = $this->sendJson('PUT', '/api/v1/products/00000000-0000-0000-0000-000000000000', ['code' => 'KF-1', 'title' => 'Chair']);

        $this->assertStatus(404);
        self::assertSame('product_not_found', $body['error']);
    }

    public function testTheTemplateHasEveryProductWithAll(): void
    {
        $this->aProduct('KF-01', 'Chair', 10.0, 'Oak');
        $this->aProduct('KF-02', 'Table');

        $rows = $this->downloadTemplate('/api/v1/products/template.xls?all=1');

        self::assertSame(['Code', 'Title', 'Detail', 'Quantity', 'Price'], $rows[0], 'The header the upload reads back.');
        $codes = array_column(\array_slice($rows, 1), 0);
        self::assertContains('KF-01', $codes);
        self::assertContains('KF-02', $codes);
        $chair = array_values(array_filter($rows, static fn (array $row): bool => 'KF-01' === $row[0]))[0];
        self::assertSame(['KF-01', 'Chair', 'Oak', 0, 0], [$chair[0], $chair[1], $chair[2], (int) $chair[3], (int) $chair[4]], 'Quantity and price start at 0, to be filled in.');
    }

    /**
     * Text typed into a product is written as text: a code, title or detail starting with "=" is not a formula in the
     * downloaded sheet (spreadsheet formula injection), and it reads back exactly as typed when the sheet is uploaded.
     */
    public function testTextStartingWithAnEqualsSignIsWrittenAsText(): void
    {
        $this->aProduct('=1+1', '=HYPERLINK("https://evil.example/","Click")', 10.0, '=cmd|\' /C calc\'!A0');
        $this->aProduct('123', 'Chair');

        $this->client->request('GET', '/api/v1/products/template.xls?all=1');
        $this->assertStatus(200);
        $path = $this->tempFile((string) $this->client->getResponse()->getContent());
        $sheet = IOFactory::load($path)->getActiveSheet();

        $row = null;
        foreach ($sheet->getRowIterator(2) as $candidate) {
            if ('=1+1' === $sheet->getCell('A'.$candidate->getRowIndex())->getValue()) {
                $row = $candidate->getRowIndex();
            }
        }
        self::assertNotNull($row, 'The code reads back as typed, not as its result (2).');
        foreach (['A' => '=1+1', 'B' => '=HYPERLINK("https://evil.example/","Click")', 'C' => '=cmd|\' /C calc\'!A0'] as $column => $text) {
            $cell = $sheet->getCell($column.$row);
            self::assertSame(DataType::TYPE_STRING, $cell->getDataType(), "{$column}{$row} is text, not a formula.");
            self::assertSame($text, $cell->getValue());
        }
        $numeric = false;
        foreach ($sheet->getRowIterator(2) as $candidate) {
            $cell = $sheet->getCell('A'.$candidate->getRowIndex());
            $numeric = $numeric || (123 == $cell->getValue() && DataType::TYPE_NUMERIC === $cell->getDataType());
        }
        self::assertTrue($numeric, 'Other values are written as before (a numeric code is still a number).');
    }

    public function testTheTemplateHasTheSelectedProducts(): void
    {
        $a = $this->aProduct('KF-01');
        $b = $this->aProduct('KF-02');
        $this->aProduct('KF-03');

        $rows = $this->downloadTemplate("/api/v1/products/template.xls?uuid[]={$a->getUuid()}&uuid[]={$b->getUuid()}");

        $codes = array_column(\array_slice($rows, 1), 0);
        sort($codes);
        self::assertSame(['KF-01', 'KF-02'], $codes, 'Every selected row (the legacy finder found nothing for two or more).');
    }

    public function testTheEmptyTemplateHasOnlyTheHeader(): void
    {
        $this->aProduct('KF-01');

        $rows = $this->downloadTemplate('/api/v1/products/template.xls');

        self::assertCount(1, $rows, 'Without all or a selection: the header to fill in.');
    }

    public function testAnUploadedSheetCreatesProductsAndTheirStock(): void
    {
        $colombia = $this->aWarehouse('Colombia');

        $body = $this->upload($colombia->getId(), [
            ['Code', 'Title', 'Detail', 'Quantity', 'Price'],
            ['KF-01', 'Chair', 'Oak', 100, 25.5],
            ['KF-02', null, null, 5, 10],
            ['', 'No code', '', 3, 1],
        ]);

        $this->assertStatus(200);
        self::assertSame(['stored' => 2], $body, 'The header and rows without a code are skipped.');
        $this->em()->clear();
        $chair = $this->em()->getRepository(Product::class)->findOneBy(['code' => 'KF-01']);
        self::assertInstanceOf(Product::class, $chair);
        self::assertSame(['Chair', 'Oak', 25.5, 1], [$chair->getTitle(), $chair->getDetail(), $chair->getPrice(), $chair->getStatus()]);
        self::assertSame([['status' => ProductWarehouse::STATUS_CONFIRMED, 'quantity' => 100]], $this->stockRows($chair, $colombia), 'Uploaded stock is in stock, not incoming.');
        $untitled = $this->em()->getRepository(Product::class)->findOneBy(['code' => 'KF-02']);
        self::assertSame('KF-02', $untitled?->getTitle(), 'A product without a title is named by its code.');
    }

    public function testUploadingAgainSumsTheQuantitiesAndUpdatesTheProduct(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $product = $this->aProduct('KF-01', 'Chair', 10.0);
        $this->aStock($product, $colombia, 100);

        $body = $this->upload($colombia->getId(), [
            ['Code', 'Title', 'Detail', 'Quantity', 'Price'],
            ['KF-01', 'Armchair', 'Leather', 50, 30],
            ['KF-01', 'Ignored', 'Ignored', 1000, 1],
        ]);

        $this->assertStatus(200);
        self::assertSame(['stored' => 1], $body, 'A code repeated in the sheet is stored once (its first row).');
        self::assertSame([['status' => ProductWarehouse::STATUS_CONFIRMED, 'quantity' => 150]], $this->stockRows($product, $colombia), 'The sheet adds to the stock already there.');
        $saved = $this->em()->find(Product::class, $product->getId());
        self::assertSame(['Armchair', 'Leather', 30.0], [$saved?->getTitle(), $saved?->getDetail(), $saved?->getPrice()], 'The sheet updates the product.');
    }

    public function testRowsBreakingTheProductRulesAreSkipped(): void
    {
        $colombia = $this->aWarehouse('Colombia');

        $body = $this->upload($colombia->getId(), [
            ['Code', 'Title', 'Detail', 'Quantity', 'Price'],
            ['CODE', 'PRODUCT', 'header of an old template', 0, 0],
            ['KF-01', 'PRODUCT', '', 1, 1],
            ['KF-02', 'Table', '', 1, 1],
        ]);

        $this->assertStatus(200);
        self::assertSame(['stored' => 1], $body, 'As ProductService did with the entity\'s validation: a row that breaks it is not stored.');
        $this->em()->clear();
        self::assertNull($this->em()->getRepository(Product::class)->findOneBy(['code' => 'KF-01']));
    }

    public function testAFileThatIsNotASpreadsheetIsUnsupported(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $path = $this->tempFile('just text, no spreadsheet');

        $this->client->request('POST', '/api/v1/products/upload', ['warehouse_id' => (string) $colombia->getId()], ['file' => new UploadedFile($path, 'stock.xls', null, null, true)], ['HTTP_ACCEPT' => 'application/json']);

        $this->assertStatus(415);
        self::assertSame('unsupported_media', $this->body()['error'], 'The same MIME list as the legacy form, checked on the content.');
    }

    public function testAnUploadNeedsAFileAndAWarehouse(): void
    {
        $this->client->request('POST', '/api/v1/products/upload', [], [], ['HTTP_ACCEPT' => 'application/json']);

        $this->assertStatus(422);
        $fields = array_column($this->body()['violations'], 'field');
        self::assertContains('file', $fields);
        self::assertContains('warehouse_id', $fields);
    }

    public function testAnUploadToAnUnknownWarehouseIsNotFound(): void
    {
        $body = $this->upload(999999, [['Code', 'Title', 'Detail', 'Quantity', 'Price'], ['KF-01', 'Chair', '', 1, 1]]);

        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $body['error']);
    }

    public function testAnUnreadableSpreadsheetIsInvalid(): void
    {
        // A real xlsx cut short: a zip whose entries cannot be read.
        $path = $this->tempFile('');
        (new XlsxWriter(new Spreadsheet()))->save($path);
        file_put_contents($path, substr((string) file_get_contents($path), 0, 200));

        $this->expectException(InvalidSpreadsheet::class);
        (new PhpSpreadsheetProductSheetReader())->rows($path);
    }

    /**
     * A corrupt xls whose sector table points back at itself: PhpSpreadsheet up to 2.4.6 followed the chain until PHP
     * ran out of memory (CVE-2026-59933, a fatal error the reader could not catch). It is refused like any unreadable
     * file.
     */
    public function testAnXlsWhoseSectorChainLoopsIsInvalid(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $sheet = new Spreadsheet();
        $sheet->getActiveSheet()->fromArray([['Code', 'Title', 'Detail', 'Quantity', 'Price'], ['KF-01', 'Chair', '', 1, 1]]);
        $path = $this->tempFile('');
        (new Xls($sheet))->save($path);
        $bytes = (string) file_get_contents($path);
        // The first sector after the 512-byte header: every entry of the allocation table says "next is sector 1".
        $bytes = substr($bytes, 0, 512).str_repeat(pack('V', 1), 128).substr($bytes, 1024);
        file_put_contents($path, $bytes);

        $this->client->request('POST', '/api/v1/products/upload', ['warehouse_id' => (string) $colombia->getId()], ['file' => new UploadedFile($path, 'stock.xls', null, null, true)], ['HTTP_ACCEPT' => 'application/json']);

        $this->assertStatus(422);
        self::assertSame('invalid_spreadsheet', $this->body()['error']);
    }

    /**
     * Only the Excel readers are used: IOFactory would otherwise read HTML, CSV, SYLK, Gnumeric… as a spreadsheet,
     * each a reader (and a parser) the stock sheet never needs.
     */
    public function testTheReaderReadsOnlyExcelFiles(): void
    {
        $path = $this->tempFile('<html><body><table><tr><td>KF-01</td><td>Chair</td></tr></table></body></html>');

        $this->expectException(InvalidSpreadsheet::class);
        (new PhpSpreadsheetProductSheetReader())->rows($path);
    }

    /**
     * @param list<list<mixed>> $rows
     *
     * @return array<mixed>
     */
    private function upload(int $warehouseId, array $rows): array
    {
        $sheet = new Spreadsheet();
        $sheet->getActiveSheet()->fromArray($rows, null, 'A1', true);
        $path = $this->tempFile('');
        (new Xls($sheet))->save($path);

        $this->client->request('POST', '/api/v1/products/upload', ['warehouse_id' => (string) $warehouseId], ['file' => new UploadedFile($path, 'stock.xls', null, null, true)], ['HTTP_ACCEPT' => 'application/json']);

        return $this->body();
    }

    /**
     * @return list<list<mixed>>
     */
    private function downloadTemplate(string $uri): array
    {
        $this->client->request('GET', $uri);
        $response = $this->client->getResponse();
        $content = (string) $response->getContent();
        $this->assertStatus(200);
        self::assertSame('application/vnd.ms-excel', $response->headers->get('Content-Type'));
        self::assertSame('attachment;filename="Products.xls"', $response->headers->get('Content-Disposition'), 'The same file name as before.');

        $path = $this->tempFile($content);
        /** @var list<list<mixed>> $rows */
        $rows = IOFactory::load($path)->getActiveSheet()->toArray();

        return $rows;
    }

    private function tempFile(string $content): string
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'kf-sheet-');
        file_put_contents($path, $content);
        $this->files[] = $path;

        return $path;
    }
}
