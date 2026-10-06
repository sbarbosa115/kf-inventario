<?php

namespace App\Customers\Infrastructure\Persistence;

use App\Customers\Application\Query\Locations;
use Doctrine\DBAL\Connection;

/**
 * One query read as rows: production holds about 70,000 countries, states and cities (a row per legacy address),
 * which as Doctrine entities took more memory than the cPanel account allows.
 */
final class DoctrineLocations implements Locations
{
    public function __construct(private readonly Connection $db)
    {
    }

    public function tree(): array
    {
        $rows = $this->db->executeQuery(
            'SELECT c.id AS c_id, c.name AS c_name, c.code AS c_code, s.id AS s_id, s.name AS s_name, s.code AS s_code,
                    ci.id AS ci_id, ci.name AS ci_name
             FROM country c
             INNER JOIN state s ON s.country_id = c.id
             LEFT JOIN city ci ON ci.state_id = s.id
             ORDER BY c.id, s.id, ci.id',
        );

        $countries = [];
        $country = $state = null;
        while (false !== ($row = $rows->fetchAssociative())) {
            if (null === $country || $country['id'] !== (int) $row['c_id']) {
                if (null !== $country) {
                    $country['states'][] = $state;
                    $countries[] = $country;
                }
                $country = ['id' => (int) $row['c_id'], 'name' => (string) $row['c_name'], 'code' => $row['c_code'], 'states' => []];
                $state = null;
            }
            if (null === $state || $state['id'] !== (int) $row['s_id']) {
                if (null !== $state) {
                    $country['states'][] = $state;
                }
                $state = ['id' => (int) $row['s_id'], 'name' => (string) $row['s_name'], 'code' => $row['s_code'], 'cities' => []];
            }
            if (null !== $row['ci_id']) {
                $state['cities'][] = ['id' => (int) $row['ci_id'], 'name' => (string) $row['ci_name']];
            }
        }
        if (null !== $country) {
            $country['states'][] = $state;
            $countries[] = $country;
        }

        return $countries;
    }
}
