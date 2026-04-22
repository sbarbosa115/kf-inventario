<?php

namespace App\Tests\Unit\Utils;

use App\Entity\User;
use App\Tests\WebTestCase;
use Symfony\Bundle\FrameworkBundle\Client;
use Symfony\Component\BrowserKit\Cookie;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

class UserWebTestCase extends WebTestCase
{
    /** @var Client */
    public $client;

    public function setUp(): void
    {
        $this->client = static::createClient();
    }

    public function logIn(array $roles = ['ROLE_ADMIN']): void
    {
        $session = $this->client->getContainer()->get('session');

        $firewallName = 'main';
        $firewallContext = 'main';

        $user = $this->client->getContainer()->get('doctrine')->getRepository(User::class)->findOneBy(['username' => 'sbarbosa115']);

        $token = new UsernamePasswordToken($user, null, $firewallName, $roles);
        $session->set('_security_'.$firewallContext, serialize($token));
        $session->save();

        $cookie = new Cookie($session->getName(), $session->getId());
        $this->client->getCookieJar()->set($cookie);
    }
}
