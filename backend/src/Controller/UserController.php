<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\UserType;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/user', name: 'user_')]
#[IsGranted('ROLE_MANAGE_USERS')]
class UserController extends AbstractController
{
    #[Route('/', name: 'index')]
    public function index(
        UserRepository $userRepo
    ): Response {
        $users = $userRepo->findAll();

        return $this->render('user/index.html.twig', [
            'users' => $users,
        ]);
    }

    #[Route('/new', name: 'user_new')]
    public function new(
        Request $request,
        TranslatorInterface $translator,
        UserPasswordHasherInterface $passwordEncoder,
        EntityManagerInterface $manager
    ): Response {
        $user = new User();
        $form = $this->createForm(UserType::class, $user);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $user->setPassword($passwordEncoder->hashPassword($user, $form->get('password')->getData()));
            $manager->persist($user);
            $manager->flush();

            $this->addFlash('success', $translator->trans('user.messages.created_successfully'));

            return $this->redirectToRoute('user_index');
        }

        return $this->render('user/new.html.twig', [
            'form' => $form->createView(),
        ]);
    }

    #[Route('/edit/{user}', name: 'user_edit')]
    public function edit(
        Request $request,
        TranslatorInterface $translator,
        UserPasswordHasherInterface $passwordEncoder,
        EntityManagerInterface $manager,
        User $user
    ): Response {
        $form = $this->createForm(UserType::class, $user);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $user->setPassword($passwordEncoder->hashPassword($user, $form->get('password')->getData()));
            $manager->persist($user);
            $manager->flush();

            $this->addFlash('success', $translator->trans('user.messages.updated_successfully'));

            return $this->redirectToRoute('user_index');
        }

        return $this->render('user/edit.html.twig', [
            'form' => $form->createView(),
        ]);
    }
}
