<?php

namespace App\Tests\Functional\Identity;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

final class AuthApiTest extends ApiTestCase
{
    use SignsIn;

    public function testSigningInAnswersWhoSignedInWithEveryReachableRole(): void
    {
        $this->aUser(['ROLE_UPDATE_ORDERS'], 'ana', 'right-pass');

        $session = $this->sendJson('POST', '/api/v1/auth/login', ['username' => 'ana', 'password' => 'right-pass']);

        $this->assertStatus(200);
        self::assertSame('ana', $session['username']);
        self::assertSame('ana@kf.test', $session['email']);
        self::assertSame('Test ana', $session['name']);
        self::assertIsInt($session['id']);
        // The UI hides what the API would refuse: the roles come through the hierarchy, as is_granted sees them.
        self::assertSame(['ROLE_CAN_CREATE_ORDERS', 'ROLE_CAN_READ_ORDERS', 'ROLE_CAN_UPDATE_ORDERS', 'ROLE_UPDATE_ORDERS', 'ROLE_USER'], $session['roles']);

        $me = $this->getJson('/api/v1/auth/me');
        $this->assertStatus(200, 'The session cookie keeps the person signed in.');
        self::assertSame('ana', $me['username']);
    }

    public function testAWrongPasswordGetsOneGenericAnswer(): void
    {
        $this->aUser(['ROLE_USER'], 'ana', 'right-pass');

        $wrongPassword = $this->sendJson('POST', '/api/v1/auth/login', ['username' => 'ana', 'password' => 'nope']);
        $this->assertStatus(401);
        $unknownUser = $this->sendJson('POST', '/api/v1/auth/login', ['username' => 'nobody', 'password' => 'nope']);
        $this->assertStatus(401);

        self::assertSame('invalid_credentials', $wrongPassword['error']);
        self::assertSame($wrongPassword, $unknownUser, 'The answer never says whether the username exists.');
    }

    public function testNobodySignedInIsUnauthorized(): void
    {
        $body = $this->getJson('/api/v1/auth/me');

        $this->assertStatus(401);
        self::assertSame('unauthorized', $body['error']);
    }

    public function testSigningOutEndsTheSession(): void
    {
        $this->signInAs();

        $this->client->request('POST', '/api/v1/auth/logout');
        $this->assertStatus(204);

        $this->getJson('/api/v1/auth/me');
        $this->assertStatus(401, 'After signing out the session is gone.');
    }

    public function testAWriteFromAnotherSiteIsRefused(): void
    {
        $this->signInAs();

        $body = $this->sendJson('POST', '/api/v1/auth/logout', server: ['HTTP_ORIGIN' => 'https://evil.example']);

        $this->assertStatus(403, 'The session cookie must not let another site write.');
        self::assertSame('forbidden', $body['error']);
    }

    public function testALegacyPageSendsAStrangerToTheSignInPage(): void
    {
        $this->client->request('GET', '/admin/product/');

        self::assertResponseRedirects('/admin/login');
    }

    public function testTheSignInPageIsTheReactApp(): void
    {
        $this->client->request('GET', '/admin/login');

        $this->assertStatus(200);
        self::assertSelectorExists('#root');
    }
}
