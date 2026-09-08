const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'InteractionRX/1.0 (herbal medicine registry)';

const SPARQL_QUERY = `
SELECT DISTINCT ?plant ?plantLabel ?latin ?description ?plantDescription WHERE {
  ?plant wdt:P366 ?use .
  ?use wdt:P279* wd:Q188504 .
  OPTIONAL { ?plant wdt:P225 ?latin . }
  OPTIONAL { ?plant wdt:P18 ?image . }
  ?plant rdfs:label ?plantLabel .
  FILTER(LANG(?plantLabel) = "en")
  OPTIONAL {
    ?plant schema:description ?plantDescription .
    FILTER(LANG(?plantDescription) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 150
`;

const GHANA_HERB_SEARCHES = [
  'Moringa oleifera',
  'Azadirachta indica',
  'Hibiscus sabdariffa',
  'Zingiber officinale',
  'Curcuma longa',
  'Vernonia amygdalina',
  'Khaya senegalensis',
  'Alstonia boonei',
  'Cassia sieberiana',
  'Kigelia africana',
  'Griffonia simplicifolia',
  'Centella asiatica',
  'Ocimum gratissimum',
  'Piper guineense',
  'Xylopia aethiopica',
];

async function wikidataSparql(query) {
  const res = await fetch(WIKIDATA_SPARQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL error: ${res.status}`);
  }

  return res.json();
}

async function searchEntity(searchTerm) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', searchTerm);
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.search?.[0] || null;
}

async function fetchEntityDetails(entityId) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', entityId);
  url.searchParams.set('props', 'labels|descriptions|claims');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.entities?.[entityId] || null;
}

function getClaimValue(claims, propertyId) {
  const claim = claims?.[propertyId]?.[0];
  if (!claim) return null;
  const datavalue = claim.mainsnak?.datavalue;
  if (!datavalue) return null;
  if (datavalue.type === 'string') return datavalue.value;
  if (datavalue.type === 'wikibase-entityid') return datavalue.value.id;
  return null;
}

async function scrapeGhanaHerbList() {
  const records = [];

  for (const searchTerm of GHANA_HERB_SEARCHES) {
    const hit = await searchEntity(searchTerm);
    if (!hit) continue;

    const entity = await fetchEntityDetails(hit.id);
    if (!entity) continue;

    const latin = getClaimValue(entity.claims, 'P225') || searchTerm;
    const label = entity.labels?.en?.value || hit.label || searchTerm;
    const description = entity.descriptions?.en?.value || hit.description || '';

    records.push({
      name: label,
      latin_name: latin,
      description: description || `Medicinal plant documented in Wikidata (${hit.id}).`,
      composition: null,
      origin: 'Wikidata (Ghana-relevant medicinal plants)',
      source_type: 'wikidata',
      source_id: hit.id,
      source_url: `https://www.wikidata.org/wiki/${hit.id}`,
      raw_metadata: {
        wikidata_id: hit.id,
        search_term: searchTerm,
        label,
      },
    });

    await new Promise((r) => setTimeout(r, 200));
  }

  return records;
}

export async function scrapeWikidata() {
  const records = [];
  const seen = new Set();

  try {
    const ghanaRecords = await scrapeGhanaHerbList();
    for (const record of ghanaRecords) {
      const key = `${record.source_type}:${record.source_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push(record);
      }
    }
  } catch (err) {
    console.warn('Wikidata Ghana herb list failed:', err.message);
  }

  try {
    const data = await wikidataSparql(SPARQL_QUERY);
    const bindings = data.results?.bindings || [];

    for (const row of bindings) {
      const plantUri = row.plant?.value || '';
      const wikidataId = plantUri.split('/').pop();
      if (!wikidataId || seen.has(`wikidata:${wikidataId}`)) continue;

      const label = row.plantLabel?.value;
      if (!label) continue;

      seen.add(`wikidata:${wikidataId}`);
      records.push({
        name: label,
        latin_name: row.latin?.value || null,
        description:
          row.plantDescription?.value ||
          `Medicinal plant from Wikidata (${wikidataId}).`,
        composition: null,
        origin: 'Wikidata (medicinal plants)',
        source_type: 'wikidata',
        source_id: wikidataId,
        source_url: `https://www.wikidata.org/wiki/${wikidataId}`,
        raw_metadata: {
          wikidata_id: wikidataId,
          sparql: true,
        },
      });
    }
  } catch (err) {
    console.warn('Wikidata SPARQL failed:', err.message);
  }

  return records;
}
