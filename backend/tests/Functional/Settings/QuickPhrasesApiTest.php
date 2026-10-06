<?php

namespace App\Tests\Functional\Settings;

use App\Audit\Domain\Model\Log;
use App\Settings\Domain\Model\QuickPhrase;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The quick phrases of the comment box (docs/pdr/prd-shops-settings.md, "API changes" › Settings): anyone signed in
 * reads the active ones in order (the phrase bar); an admin adds, renames, hides, reorders and deletes them.
 */
final class QuickPhrasesApiTest extends ApiTestCase
{
    use SignsIn;

    public function testAnyoneSignedInReadsTheActivePhrasesInOrder(): void
    {
        $at = new \DateTimeImmutable();
        $this->save(
            new QuickPhrase('Waiting for payment', 2, $at),
            new QuickPhrase('Customer called', 0, $at),
            new QuickPhrase('Old phrase', 1, $at, false),
        );
        $this->signInAs(['ROLE_USER']);

        $list = $this->getJson('/api/v1/settings/quick-phrases');

        $this->assertStatus(200);
        self::assertSame(['Customer called', 'Waiting for payment'], array_column($list, 'text'), 'Active only, by position.');
        self::assertSame(['id', 'text', 'position', 'active'], array_keys($list[0]));
        self::assertSame(['Customer called', 'Waiting for payment'], array_column($this->getJson('/api/v1/settings/quick-phrases?all=1'), 'text'), '?all=1 is the admin\'s: a user still gets the active ones.');
    }

    public function testAnAdminAddsRenamesHidesAndDeletesAPhrase(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $first = $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => '  Customer called  ']);
        $this->assertStatus(201);
        self::assertSame(['text' => 'Customer called', 'position' => 0, 'active' => true], array_diff_key($first, ['id' => 0]), 'Trimmed, at the end.');
        $second = $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => 'Waiting for payment']);
        self::assertSame(1, $second['position']);

        $renamed = $this->sendJson('PUT', '/api/v1/settings/quick-phrases/'.$second['id'], ['text' => 'Waiting for the payment', 'active' => false]);
        $this->assertStatus(200);
        self::assertSame(['id' => $second['id'], 'text' => 'Waiting for the payment', 'position' => 1, 'active' => false], $renamed);
        self::assertSame(['Customer called'], array_column($this->getJson('/api/v1/settings/quick-phrases'), 'text'), 'A hidden phrase leaves the bar.');
        self::assertSame(['Customer called', 'Waiting for the payment'], array_column($this->getJson('/api/v1/settings/quick-phrases?all=1'), 'text'), 'The admin\'s tab lists every phrase.');

        $this->client->request('DELETE', '/api/v1/settings/quick-phrases/'.$first['id']);
        $this->assertStatus(204);
        self::assertSame(['Waiting for the payment'], array_column($this->getJson('/api/v1/settings/quick-phrases?all=1'), 'text'));

        $this->em()->clear();
        $log = $this->em()->getRepository(Log::class)->findOneBy(['entity' => 'settings'], ['id' => 'DESC']);
        self::assertNotNull($log, 'Phrase changes are in the activity log.');
    }

    public function testAnAdminReordersThePhrases(): void
    {
        $this->signInAs(['ROLE_ADMIN']);
        $a = $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => 'A']);
        $b = $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => 'B']);
        $c = $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => 'C']);

        $list = $this->sendJson('PUT', '/api/v1/settings/quick-phrases/order', ['ids' => [$c['id'], $a['id']]]);

        $this->assertStatus(200);
        self::assertSame(['C', 'A', 'B'], array_column($list, 'text'), 'The ids given first, the others after them in their order.');
        self::assertSame([0, 1, 2], array_column($list, 'position'));
        self::assertSame(['C', 'A', 'B'], array_column($this->getJson('/api/v1/settings/quick-phrases'), 'text'));
        $this->sendJson('PUT', '/api/v1/settings/quick-phrases/order', ['ids' => [$b['id'], 999999]]);
        $this->assertStatus(404, 'An id that is not a phrase.');
    }

    public function testABlankOrUnknownPhraseIsRefused(): void
    {
        $this->signInAs(['ROLE_ADMIN']);

        $error = $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => '   ']);
        $this->assertStatus(422);
        self::assertSame('text', $error['violations'][0]['field']);
        $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => str_repeat('x', 256)]);
        $this->assertStatus(422);

        $error = $this->sendJson('PUT', '/api/v1/settings/quick-phrases/999999', ['text' => 'X']);
        $this->assertStatus(404);
        self::assertSame('quick_phrase_not_found', $error['error']);
        $this->client->request('DELETE', '/api/v1/settings/quick-phrases/999999');
        $this->assertStatus(404);
    }

    public function testOnlyAnAdminChangesThem(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', '/api/v1/settings/quick-phrases', ['text' => 'X']);
        $this->assertStatus(403);
        $this->sendJson('PUT', '/api/v1/settings/quick-phrases/order', ['ids' => []]);
        $this->assertStatus(403);
    }
}
