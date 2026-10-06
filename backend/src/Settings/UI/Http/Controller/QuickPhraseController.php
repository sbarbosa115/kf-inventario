<?php

namespace App\Settings\UI\Http\Controller;

use App\Settings\Application\Command\DeleteQuickPhrase;
use App\Settings\Application\Command\ReorderQuickPhrases;
use App\Settings\Application\Command\SavedQuickPhrase;
use App\Settings\Application\Command\SaveQuickPhrase;
use App\Settings\Application\Query\QuickPhrases;
use App\Settings\Application\Query\QuickPhraseView;
use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\UI\Http\Input\QuickPhraseInput;
use App\Settings\UI\Http\Input\QuickPhraseOrderInput;
use App\Settings\UI\Http\Output\QuickPhraseOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The quick phrases of the comment box (docs/pdr/prd-shops-settings.md, "API changes" › Settings): read by anyone
 * signed in (the comment box's phrase bar), edited by an admin (Settings › Quick phrases).
 */
final class QuickPhraseController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly InputMapper $inputs,
        private readonly QuickPhrases $phrases,
    ) {
    }

    /**
     * The active phrases in order. `?all=1`: every one, the hidden too (an admin's; anyone else still gets the active
     * ones).
     */
    #[Route('/api/v1/settings/quick-phrases', name: 'api_quick_phrases', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(QuickPhraseOutput::class, list: true)]
    public function list(Request $request): JsonResponse
    {
        $all = $request->query->getBoolean('all') && $this->isGranted('ROLE_ADMIN');

        return $this->json($this->outputs($all));
    }

    /**
     * QuickPhraseInput: a phrase at the end → 201.
     */
    #[Route('/api/v1/settings/quick-phrases', name: 'api_quick_phrases_create', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(QuickPhraseOutput::class, status: 201)]
    public function create(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), QuickPhraseInput::class);

        /** @var SavedQuickPhrase $saved */
        $saved = $this->commands->dispatch(new SaveQuickPhrase(null, $input->text, $input->active));

        return $this->json($this->output($saved->id()), Response::HTTP_CREATED);
    }

    /**
     * QuickPhraseOrderInput: the phrases' new order (these ids first, the others after them) → every phrase. 404
     * quick_phrase_not_found for an id that is not a phrase.
     */
    #[Route('/api/v1/settings/quick-phrases/order', name: 'api_quick_phrases_order', methods: ['PUT'], priority: 1)]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(QuickPhraseOutput::class, list: true)]
    public function reorder(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), QuickPhraseOrderInput::class);

        $this->commands->dispatch(new ReorderQuickPhrases(array_map(intval(...), $input->ids)));

        return $this->json($this->outputs(true));
    }

    /**
     * QuickPhraseInput: renames it or switches it off. 404 quick_phrase_not_found.
     */
    #[Route('/api/v1/settings/quick-phrases/{id}', name: 'api_quick_phrases_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(QuickPhraseOutput::class)]
    public function update(int $id, Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), QuickPhraseInput::class);

        $this->commands->dispatch(new SaveQuickPhrase($id, $input->text, $input->active));

        return $this->json($this->output($id));
    }

    /**
     * 204. 404 quick_phrase_not_found.
     */
    #[Route('/api/v1/settings/quick-phrases/{id}', name: 'api_quick_phrases_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_ADMIN')]
    public function delete(int $id): Response
    {
        $this->commands->dispatch(new DeleteQuickPhrase($id));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * @return list<QuickPhraseOutput>
     */
    private function outputs(bool $all): array
    {
        return array_map(self::toOutput(...), $this->phrases->list($all));
    }

    private function output(int $id): QuickPhraseOutput
    {
        foreach ($this->phrases->list(true) as $phrase) {
            if ($phrase->id === $id) {
                return self::toOutput($phrase);
            }
        }
        throw new QuickPhraseNotFound();
    }

    private static function toOutput(QuickPhraseView $phrase): QuickPhraseOutput
    {
        return new QuickPhraseOutput($phrase->id, $phrase->text, $phrase->position, $phrase->active);
    }
}
