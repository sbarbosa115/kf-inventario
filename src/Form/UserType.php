<?php

namespace App\Form;

use App\Entity\User;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class UserType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder->add('name', TextType::class, [
            'attr' => [
                'class' => 'form-control',
                'label' => 'user.new.name',
            ],
        ])
        ->add('email', EmailType::class, [
            'attr' => [
                'class' => 'form-control',
                'label' => 'user.new.email',
            ],
        ])
        ->add('username', TextType::class, [
            'attr' => [
                'class' => 'form-control',
                'label' => 'user.new.username',
            ],
        ])
        ->add('password', PasswordType::class, [
            'attr' => [
                'class' => 'form-control',
                'label' => 'user.new.password',
            ],
        ])
        ->add('roles', ChoiceType::class, [
            'choices' => [
                'ROLE_ADMIN' => 'ROLE_ADMIN',
                'ROLE_MANAGE_INVENTORY' => 'ROLE_MANAGE_INVENTORY',
                'ROLE_MANAGE_ORDERS' => 'ROLE_MANAGE_ORDERS',
                'ROLE_UPDATE_ORDERS' => 'ROLE_UPDATE_ORDERS',
                'ROLE_UPDATE_INVOICES' => 'ROLE_UPDATE_INVOICES',
                'ROLE_CAN_READ_INVOICES' => 'ROLE_CAN_READ_INVOICES',
                'ROLE_CAN_CREATE_INVOICES' => 'ROLE_CAN_CREATE_INVOICES',
                'ROLE_MANAGE_USERS' => 'ROLE_MANAGE_USERS',
                'ROLE_MANAGE_WAREHOUSES' => 'ROLE_MANAGE_WAREHOUSES',
            ],
            'attr' => [
                'class' => 'form-control',
                'label' => 'user.new.roles',
            ],
            'multiple' => true,
        ])
        ->add('enabled', ChoiceType::class, [
            'choices' => [
                'Enabled' => '1',
                'Disabled' => '0',
            ],
            'attr' => [
                'class' => 'form-control',
                'label' => 'user.new.enabled',
            ],
            'multiple' => false,
        ])
        ->add('save', SubmitType::class, [
            'attr' => ['class' => 'btn btn-primary'],
        ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
        ]);
    }
}
