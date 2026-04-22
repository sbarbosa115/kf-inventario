<?php

namespace App\Form;

use App\Entity\Warehouse;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\FileType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\File;
use Symfony\Component\Validator\Constraints\Required;

class UploadProductsType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder->add('products', FileType::class, [
            'constraints' => [
                new Required(),
                new File(['mimeTypes' => [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
                ]]),
            ],
            'attr' => [
                'class' => 'form-control-file',
                'label' => 'product.upload.label_input',
            ],
        ])->add('warehouse', EntityType::class, [
            'class' => Warehouse::class,
            'choice_label' => 'name',
            'constraints' => [
                new Required(),
            ],
            'attr' => [
                'class' => 'form-control',
            ],
        ])->add('upload', SubmitType::class, [
            'attr' => ['class' => 'btn btn-primary'],
        ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            // Configure your form options here
        ]);
    }
}
