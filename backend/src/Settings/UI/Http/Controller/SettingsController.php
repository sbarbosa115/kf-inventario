<?php

namespace App\Settings\UI\Http\Controller;

use App\Identity\Domain\Model\User;
use App\Settings\Application\Command\SaveAnalyticsSettings;
use App\Settings\Application\Command\SaveEmailSettings;
use App\Settings\Application\Command\SaveWebhookSettings;
use App\Settings\Application\Command\SendTestEmail;
use App\Settings\Application\Command\SentTestEmail;
use App\Settings\Application\Query\AnalyticsSettings;
use App\Settings\Application\Query\EmailSettings;
use App\Settings\Application\Query\WebhookSettings;
use App\Settings\UI\Http\Input\AnalyticsSettingsInput;
use App\Settings\UI\Http\Input\EmailSettingsInput;
use App\Settings\UI\Http\Input\TestEmailInput;
use App\Settings\UI\Http\Input\WebhookSettingsInput;
use App\Settings\UI\Http\Output\AnalyticsSettingsOutput;
use App\Settings\UI\Http\Output\EmailSettingsOutput;
use App\Settings\UI\Http\Output\EmailSourcesOutput;
use App\Settings\UI\Http\Output\PublicSettingsOutput;
use App\Settings\UI\Http\Output\TestEmailResultOutput;
use App\Settings\UI\Http\Output\WebhookSettingsOutput;
use App\Shared\Application\Command\CommandBus;
use App\Shared\UI\Http\ApiResponse;
use App\Shared\UI\Http\InputMapper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Settings (docs/pdr/prd-shops-settings.md, "API changes" › Settings): the admin's email, analytics and webhook
 * settings, and the analytics IDs every signed-in page reads. Every change is in the activity log by key, never by
 * value.
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
     * env applies) → EmailSettingsOutput; 422 on a bad address or a host that is not a host name alone. A blank
     * password is kept only while the host stays the same.
     */
    #[Route('/api/v1/settings/email', name: 'api_settings_email_save', methods: ['PUT'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(EmailSettingsOutput::class)]
    public function saveEmail(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), EmailSettingsInput::class);

        $this->commands->dispatch(new SaveEmailSettings(
            host: $input->host,
            port: $input->port,
            user: $input->user,
            password: $input->password,
            encryption: $input->encryption,
            fromAddress: $input->fromAddress,
            fromName: $input->fromName,
            printerAddress: $input->printerAddress,
            cc: array_map(strval(...), $input->cc),
            actorId: $this->actorId(),
        ));

        return $this->json($this->emailOutput());
    }

    /**
     * TestEmailInput: sends "KF Inventory test email" to `to` through the effective server, at once (not queued) →
     * 202 with the host it went through; 502 smtp_failed with the server's message in detail.reason; 429
     * test_email_too_soon more than once in 10 s; 422 on from_address when no sender is set anywhere.
     */
    #[Route('/api/v1/settings/email/test', name: 'api_settings_email_test', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(TestEmailResultOutput::class, status: 202)]
    public function testEmail(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), TestEmailInput::class);

        /** @var SentTestEmail $sent */
        $sent = $this->commands->dispatch(new SendTestEmail($input->to, $this->actorId()));

        return $this->json(new TestEmailResultOutput(true, $sent->host), 202);
    }

    /**
     * Settings › Analytics: the GA4 Measurement ID and the Clarity Project ID (null: that tool is off).
     */
    #[Route('/api/v1/settings/analytics', name: 'api_settings_analytics', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(AnalyticsSettingsOutput::class)]
    public function analytics(): JsonResponse
    {
        return $this->json($this->analyticsOutput());
    }

    /**
     * AnalyticsSettingsInput: G-XXXXXXX and the Clarity Project ID (empty turns one off); 422 on a wrong shape.
     */
    #[Route('/api/v1/settings/analytics', name: 'api_settings_analytics_save', methods: ['PUT'])]
    #[IsGranted('ROLE_ADMIN')]
    #[ApiResponse(AnalyticsSettingsOutput::class)]
    public function saveAnalytics(Request $request): JsonResponse
    {
        $input = $this->inputs->map($this->inputs->json($request), AnalyticsSettingsInput::class);

        $this->commands->dispatch(new SaveAnalyticsSettings($input->ga4MeasurementId, $input->clarityProjectId, $this->actorId()));

        return $this->json($this->analyticsOutput());
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

    private function analyticsOutput(): AnalyticsSettingsOutput
    {
        $analytics = $this->analytics->current();

        return new AnalyticsSettingsOutput($analytics->ga4MeasurementId, $analytics->clarityProjectId);
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
