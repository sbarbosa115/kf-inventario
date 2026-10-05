<?php

namespace App\Controller;

use App\Invoicing\Domain\Model\Invoice;
use App\Form\InvoiceType;
use App\Repository\InvoiceRepository;
use App\Services\InvoiceService;
use App\Services\PdfHandlerService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/invoice', name: 'invoice_')]
class InvoiceController extends AbstractController
{
    #[Route('/create', name: 'create', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_CREATE_INVOICES')]
    public function create(Request $request, InvoiceService $invoiceService, InvoiceRepository $invoiceRepository): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!empty($data['code'])) {
            $existing = $invoiceRepository->findByCode($data['code']);
            if ($existing) {
                return new JsonResponse(['status' => false, 'error' => 'Invoice code already exists'], 400);
            }
        }

        $result = $invoiceService->createFromProducts($data, $this->getUser());

        return new JsonResponse(['status' => true, 'invoice' => $result]);
    }

    #[Route('/all', name: 'all', options: ['expose' => true], methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    public function all(InvoiceRepository $invoiceRepository, InvoiceService $invoiceService): JsonResponse
    {
        $invoices = $invoiceRepository->findBy([], ['createdAt' => 'DESC']);
        $data = array_map(function ($invoice) use ($invoiceService) {
            return $invoiceService->getInvoiceAsArray($invoice);
        }, $invoices);

        return new JsonResponse($data);
    }

    #[Route('/detail/{invoice}', name: 'detail', methods: ['GET'], options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    public function detail(Invoice $invoice, InvoiceService $invoiceService): Response
    {
        return new JsonResponse($invoiceService->getInvoiceAsArray($invoice));
    }

    #[Route('/pdf/{invoice}', name: 'pdf', options: ['expose' => true])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    public function pdf(Invoice $invoice, PdfHandlerService $pdfHandlerService): Response
    {
        $paymentLabels = [
            'credit_counted' => 'Credit - counted',
            'credit_card' => 'Credit card - Paypal',
        ];

        $paymentLabel = '-';
        if ($invoice->getPaymentMethod()) {
            $key = $invoice->getPaymentMethod();
            $paymentLabel = $paymentLabels[$key] ?? $key;
        }

        $logoData = null;
        $projectDir = $this->getParameter('kernel.project_dir');
        $logoCandidates = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.gif'];
        $mimeMap = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
        ];

        foreach ($logoCandidates as $candidate) {
            $path = $projectDir . '/public/images/' . $candidate;
            if (file_exists($path)) {
                $ext = pathinfo($path, PATHINFO_EXTENSION);
                $mime = $mimeMap[strtolower($ext)] ?? 'application/octet-stream';
                $logoData = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
                break;
            }
        }

        $html = $this->renderView('invoice/pdf.html.twig', [
            'invoice' => $invoice,
            'paymentMethodLabel' => $paymentLabel,
            'logo_data' => $logoData,
        ]);

        $response = new Response();
        $response->setContent($pdfHandlerService->createPdf($html));
        $response->setStatusCode(200);
        $response->headers->set('Content-Type', 'application/pdf');

        return $response;
    }
}
