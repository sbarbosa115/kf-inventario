<?php

namespace App\Controller;

use App\Entity\Customer;
use App\Repository\CountryRepository;
use App\Repository\CustomerRepository;
use App\Services\CustomerService;
use App\Services\LogService;
use InvalidArgumentException;
use LogicException;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * @Route("/customer", name="customer_")
 */
class CustomerController extends AbstractController
{
    /**
     * @Route("/", name="index", options={"expose"=true})
     * @IsGranted("ROLE_MANAGE_CUSTOMERS")
     */
    public function index(
        CustomerService $customerService
    ): Response {
        $customers = $customerService->getCustomersAsArray();

        return $this->render('customer/index.html.twig', [
            'customers' => $customers,
        ]);
    }

    /**
     * @Route("/new", name="new", options={"expose"=true})
     * @IsGranted("ROLE_MANAGE_CUSTOMERS")
     */
    public function new(
        CountryRepository $countryRepo,
        CustomerService $customerService
    ): Response {
        return $this->render('customer/new.html.twig', [
            'customer' => $customerService->getCustomerAsArray(new Customer()),
            'locations' => $countryRepo->findAllAsArray(),
        ]);
    }

    /**
     * @Route("/create", name="create", options={"expose"=true}, methods={"post"})
     * @IsGranted("ROLE_MANAGE_CUSTOMERS")
     */
    public function create(
        CustomerService $customerService,
        Request $request
    ): Response {
        $customerData = json_decode($request->getContent(), true);
        $customerService->addOrUpdate($customerData);

        return new JsonResponse(['redirect' => $this->generateUrl('customer_index')]);
    }

    /**
     * @Route("/edit/{customer}", name="edit", options={"expose"=true})
     * @IsGranted("ROLE_MANAGE_CUSTOMERS")
     */
    public function edit(
        CustomerService $customerService,
        CountryRepository $countryRepo,
        Customer $customer
    ): Response {
        $customerAsArray = $customerService->getCustomerAsArray($customer);

        return $this->render('customer/edit.html.twig', [
            'customer' => $customerAsArray,
            'locations' => $countryRepo->findAllAsArray(),
        ]);
    }

    /**
     * @Route("/update", name="update", options={"expose"=true})
     * @IsGranted("ROLE_MANAGE_CUSTOMERS")
     */
    public function update(
        CustomerService $customerService,
        Request $request
    ): Response {
        $customerData = json_decode($request->getContent(), true);
        $customerService->addOrUpdate($customerData);

        return new JsonResponse(['redirect' => $this->generateUrl('customer_index')]);
    }

    /**
     * @Route("/delete", name="delete", options={"expose"=true}, methods={"DELETE"})
     * @IsGranted("ROLE_MANAGE_CUSTOMERS")
     */
    public function remove(
        Request $request,
        CustomerService $customerService,
        CustomerRepository $customerRepo,
        ValidatorInterface $validator,
        LogService $logService
    ): Response {
        $data = json_decode($request->getContent(), true);

        $constraint = new Assert\All(['constraints' => [
            'customer' => new Assert\NotBlank(), 'token' => new Assert\NotBlank(),
        ]]);

        if ($validator->validate($data, $constraint)->count() > 0) {
            throw new LogicException('Malformed request.');
        }

        if (!$this->isCsrfTokenValid('delete-customer', $data['token'])) {
            throw new LogicException('Token does not math with the expected one.');
        }

        $customer = $customerRepo->find($data['customer']);
        if (!$customer instanceof Customer) {
            throw new InvalidArgumentException('The Customer was not found.');
        }

        $logService->add('Customer', "Customer {$customer->getEmail()} was deleted");
        $customerService->delete($customer);

        return new JsonResponse(['status' => true]);
    }
}
