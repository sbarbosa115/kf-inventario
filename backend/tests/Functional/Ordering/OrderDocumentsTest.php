<?php

namespace App\Tests\Functional\Ordering;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Reader\Xls;

/**
 * The order's files, as the legacy OrderController served them: the PDF, the PDF of what is left to ship, the XLS
 * (same Twig, same headers and filename).
 */
final class OrderDocumentsTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    public function testTheOrderPdfs(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $a = $this->aProduct('KF-A', $warehouse);
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$a, 4]]);
        $this->sendJson('POST', "/api/v1/orders/{$id}/partials", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 1]]]);

        foreach (["/api/v1/orders/{$id}/pdf", "/api/v1/orders/{$id}/remaining-pdf"] as $url) {
            $this->client->request('GET', $url);

            $this->assertStatus(200, $url);
            $response = $this->client->getResponse();
            self::assertSame('application/pdf', $response->headers->get('Content-Type'), $url);
            self::assertStringStartsWith('%PDF', (string) $response->getContent(), $url);
        }

        $this->client->request('GET', '/api/v1/orders/999999/pdf');
        $this->assertStatus(404);
    }

    public function testTheOrderSpreadsheetListsItsProducts(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 4], [$this->aProduct('KF-B', $warehouse), 2]], ['code' => 'XLS-1']);
        $this->signInAs(['ROLE_USER'], 'clerk');

        $this->client->request('GET', "/api/v1/orders/{$id}/xls");

        $this->assertStatus(200, 'As before: the XLS only asks for ROLE_USER (decision 11).');
        $response = $this->client->getResponse();
        self::assertSame('application/vnd.ms-excel', $response->headers->get('Content-Type'));
        self::assertSame('attachment;filename="file-upload-template-XLS-1.xls"', $response->headers->get('Content-Disposition'), 'The legacy filename (product.xls.filename + the order code).');
        self::assertStringContainsString('max-age=0', (string) $response->headers->get('Cache-Control'));

        $file = tempnam(sys_get_temp_dir(), 'order-xls');
        file_put_contents($file, (string) $response->getContent());
        $rows = (new Xls())->load($file)->getActiveSheet()->toArray(null, true, false);
        unlink($file);
        self::assertSame(['Date', 'Product Code', 'Quantity'], $rows[0]);
        self::assertSame(['KF-A', 4], [$rows[1][1], $rows[1][2]]);
        self::assertSame(['KF-B', 2], [$rows[2][1], $rows[2][2]]);
        self::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\d$/', (string) $rows[1][0]);
    }

    /**
     * A product code starting with "=" is written as text in the order's sheet, not as a formula (spreadsheet formula
     * injection).
     */
    public function testAProductCodeStartingWithAnEqualsSignIsWrittenAsText(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('=HYPERLINK("https://evil.example/","x")', $warehouse), 1]]);

        $this->client->request('GET', "/api/v1/orders/{$id}/xls");

        $this->assertStatus(200);
        $file = tempnam(sys_get_temp_dir(), 'order-xls');
        file_put_contents($file, (string) $this->client->getResponse()->getContent());
        $cell = (new Xls())->load($file)->getActiveSheet()->getCell('B2');
        unlink($file);
        self::assertSame(DataType::TYPE_STRING, $cell->getDataType());
        self::assertSame('=HYPERLINK("https://evil.example/","x")', $cell->getValue());
    }
}
