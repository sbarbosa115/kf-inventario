<?php

namespace App\Identity\UI\Http\Controller;

use App\Identity\Application\Command\CreatedUser;
use App\Identity\Application\Command\CreateUser;
use App\Identity\Application\Command\UpdateUser;
use App\Identity\Application\Query\Users;
use App\Identity\Domain\Model\User;
use App\Identity\UI\Http\Input\UserInput;
use App\Identity\UI\Http\Output\UserOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\ApiValidationException;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The Users screen's endpoints, for ROLE_MANAGE_USERS (the legacy /admin/user pages' role).
 */
final class UserController extends AbstractController
{
    public function __construct(
        private readonly Users $users,
        private readonly CommandBus $bus,
        private readonly InputMapper $mapper,
    ) {
    }

    /**
     * Every user, by name.
     */
    #[Route('/api/v1/users', name: 'api_users_list', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class, list: true)]
    public function list(): JsonResponse
    {
        return $this->json(array_map(self::present(...), $this->users->all()));
    }

    /**
     * One user. 404 user_not_found.
     */
    #[Route('/api/v1/users/{id}', name: 'api_users_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class)]
    public function show(int $id): JsonResponse
    {
        return $this->json(self::present($this->users->get($id)));
    }

    /**
     * UserInput: creates a user. The password is required. 422 when invalid.
     */
    #[Route('/api/v1/users', name: 'api_users_create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        $input = $this->input($request);
        if (null === $input->password) {
            throw ApiValidationException::single('password', 'This value should not be blank.');
        }

        /** @var CreatedUser $created */
        $created = $this->bus->dispatch(new CreateUser($input->name, $input->username, $input->email, $input->password, array_values($input->roles), $input->enabled));

        return $this->json(self::present($this->users->get($created->id())), 201);
    }

    /**
     * UserInput: edits a user; a blank password keeps the current one. 404 user_not_found, 422 when invalid.
     */
    #[Route('/api/v1/users/{id}', name: 'api_users_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_USERS')]
    #[ApiResponse(UserOutput::class)]
    public function update(int $id, Request $request): JsonResponse
    {
        $input = $this->input($request);

        $this->bus->dispatch(new UpdateUser($id, $input->name, $input->username, $input->email, $input->password, array_values($input->roles), $input->enabled));

        return $this->json(self::present($this->users->get($id)));
    }

    /**
     * A blank password is "not given": it is the way the form says "keep the current one".
     */
    private function input(Request $request): UserInput
    {
        $data = $this->mapper->json($request);
        if (\is_string($data['password'] ?? null) && '' === trim($data['password'])) {
            $data['password'] = null;
        }

        return $this->mapper->map($data, UserInput::class);
    }

    private static function present(User $user): UserOutput
    {
        return new UserOutput(
            (int) $user->getId(),
            (string) $user->getName(),
            (string) $user->getUsername(),
            $user->getEmail(),
            array_values($user->getRoles()),
            (bool) $user->getEnabled(),
        );
    }
}
