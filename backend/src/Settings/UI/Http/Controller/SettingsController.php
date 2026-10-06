<?php

namespace App\Settings\UI\Http\Controller;

use App\Identity\Domain\Model\User;
use App\Settings\Application\Command\SaveWebhookSettings;
use App\Settings\Application\Query\AnalyticsSettings;
use App\Settings\Application\Query\EmailSettings;
use App\Settings\Application\Query\WebhookSettings;
use App\Settings\UI\Http\Input\WebhookSettingsInput;
use App\Settings\UI\Http\Output\AnalyticsSettingsOutput;
use App\Settings\UI\Http\Output\EmailSettingsOutput;
use App\Settings\UI\Http\Output\EmailSourcesOutput;
use App\Settings\UI\Http\Output\PublicSettingsOutput;
use App\Settings\UI\Http\Output\TestEmailResultOutput;
use App\Settings\UI\Http\Output\WebhookSettingsOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Settings (docs/pdr/prd-shops-settings.md, "API changes" › Settings): the admin's email, analytics and webhook
 * settings, and the analytics IDs every signed-in page reads. Item 0 builds what the Settings shell needs (public,
 * GET email, webhooks); item 3 (settings-api) builds the rest — those answer 501 until then.
 */
final class SettingsController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly InputMapper $inputs,
        private readonly EmailSettings $email,
        private readonly AnalyticsSettings $analytics,
        private readonly WebhookSettings $webhooks,
    ) {
    }

    /**
     * The analytics IDs every signed-in page loads (null: that tool is off). Any signed-in user.
     */
    #[Route('/api/v1/settings/public', name: 'api_settings_public', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(PublicSettingsOutput::class)]
    public function public(): JsonResponse
    {
        $analytics = $this->analytics->current();

        return $this->json(new PublicSettingsOutput($analytics->ga4MeasurementId, $analytics->clarityProjectId));
    }

    /**
     * Settings › Email: the SMTP server (never its password: `has_password`), the sender, the printer and the cc, each
     * with where the effective value comes from (settings, env, none).
     */
    #[Route('/api/v1/settings/email', name: 'api_settings_email', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(EmailSettingsOutput::class)]
    public function email(): JsonResponse
    {
        return $this->json($this->emailOutput());
    }

    /**
     * EmailSettingsInput: saves Settings › Email (a blank password keeps the saved one; everything empty clears it, the
     * env applies) → EmailSettingsOutput; 422 on a bad address. Item 3.
     */
    #[Route('/api/v1/settings/email', name: 'api_settings_email_save', methods: ['PUT'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(EmailSettingsOutput::class)]
    public function saveEmail(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * TestEmailInput: sends "KF Inventory test email" to `to` through the effective server, at once (not queued) →
     * 202; 502 smtp_failed with the server's message in detail.reason; 429 more than once in 10 s. Item 3.
     */
    #[Route('/api/v1/settings/email/test', name: 'api_settings_email_test', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(TestEmailResultOutput::class, status: 202)]
    public function testEmail(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Settings › Analytics. Item 3.
     */
    #[Route('/api/v1/settings/analytics', name: 'api_settings_analytics', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(AnalyticsSettingsOutput::class)]
    public function analytics(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * AnalyticsSettingsInput: G-XXXXXXX and the Clarity Project ID (empty turns one off); 422 on a wrong shape. Item 3.
     */
    #[Route('/api/v1/settings/analytics', name: 'api_settings_analytics_save', methods: ['PUT'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(AnalyticsSettingsOutput::class)]
    public function saveAnalytics(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * The legacy webhook URL's switch (on until turned off: Decisions 8) and the hits it took since it was turned off.
     */
    #[Route('/api/v1/settings/webhooks', name: 'api_settings_webhooks', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(WebhookSettingsOutput::class)]
    public function webhooks(): JsonResponse
    {
        return $this->json($this->webhooksOutput());
    }

    /**
     * WebhookSettingsInput: turns the legacy webhook URL off (410 from then on; its counter starts at 0) or on.
     */
    #[Route('/api/v1/settings/webhooks', name: 'api_settings_webhooks_save', methods: ['PUT'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(WebhookSettingsOutput::class)]
    public function saveWebhooks(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), WebhookSettingsInput::class);

        $this->commands->dispatch(new SaveWebhookSettings((bool) $input->legacyEnabled, $this->actorId()));

        return $this->json($this->webhooksOutput());
    }

    private function emailOutput(): EmailSettingsOutput
    {
        $stored = $this->email->stored();

        return new EmailSettingsOutput(
            dsnHost: $stored->host,
            dsnPort: $stored->port,
            dsnUser: $stored->user,
            hasPassword: $stored->hasPassword,
            encryption: $stored->encryption,
            fromAddress: $stored->fromAddress,
            fromName: $stored->fromName,
            printerAddress: $stored->printerAddress,
            cc: $stored->cc,
            source: new EmailSourcesOutput($stored->sources['dsn'], $stored->sources['from'], $stored->sources['printer'], $stored->sources['cc']),
            envHost: $stored->envHost,
        );
    }

    private function webhooksOutput(): WebhookSettingsOutput
    {
        $legacy = $this->webhooks->legacy();

        return new WebhookSettingsOutput($legacy->enabled, $legacy->hitsSince, $legacy->lastHitAt?->format(\DATE_ATOM));
    }

    private function actorId(): ?int
    {
        $user = $this->getUser();

        return $user instanceof User ? $user->getId() : null;
    }
}
