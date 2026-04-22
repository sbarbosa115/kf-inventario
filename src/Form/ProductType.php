<?php

namespace App\Form;

use App\Entity\Product;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\NumberType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class ProductType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('code', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'label' => 'product.edit.code',
                ],
            ])
            ->add('title', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'label' => 'product.edit.code',
                ],
            ])
            ->add('detail', TextareaType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'label' => 'product.edit.code',
                ],
            ])
            ->add('status', ChoiceType::class, [
                'choices' => [
                   'product_statuses.1' => 1,
                   'product_statuses.0' => 0,
                ],
                'attr' => [
                    'class' => 'form-control',
                    'label' => 'product.edit.code',
                ],
                'choice_translation_domain' => true,
            ])
            ->add('price', NumberType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'label' => 'product.edit.code',
                ],
            ])
            ->add('save', SubmitType::class, ['attr' => ['class' => 'btn btn-primary']]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Product::class,
        ]);
    }
}
