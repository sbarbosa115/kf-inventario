<?php

namespace App\Tests\Unit\Shared;

use App\Shared\Infrastructure\Pdf\DompdfRenderer;
use PHPUnit\Framework\TestCase;

final class DompdfRendererTest extends TestCase
{
    public function testHtmlBecomesALetterSizedPdf(): void
    {
        $pdf = (new DompdfRenderer())->render('<html><body><h1>Order #1</h1></body></html>');

        self::assertStringStartsWith('%PDF', $pdf, 'The bytes are a PDF document.');
        self::assertMatchesRegularExpression('#/MediaBox \[0(\.0+)? 0(\.0+)? 612(\.0+)? 792(\.0+)?\]#', $pdf, 'Letter paper, portrait (8.5 x 11 in), as the legacy PdfHandlerService.');
    }
}
