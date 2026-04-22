<?php

namespace App\Validator\Constraint;

use App\Entity\Order;
use App\Repository\OrderRepository;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;

class OrderExistByIdValidator extends ConstraintValidator
{
    /** @var OrderRepository */
    private $orderRepo;

    public function __construct(
        OrderRepository $orderRepo
    ) {
        $this->orderRepo = $orderRepo;
    }

    public function validate($value, Constraint $constraint): void
    {
        $order = $this->orderRepo->find($value);

        if (!$order instanceof Order) {
            $this->context->buildViolation($constraint->message)
                ->addViolation();
        }
    }
}
