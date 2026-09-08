const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const USER_AGENT = 'InteractionRX/1.0 (herbal medicine registry; mailto:support@dataleap.tech)';

const SEARCH_QUERIES = [
  'herbal medicine Ghana',
  'medicinal plants Ghana',
  'ethnobotany Ghana',
  'traditional medicine West Africa',
  'herb-drug interaction Africa',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ncbiFetch(path, params) {
  const url = new URL(`${NCBI_BASE}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('tool', 'InteractionRX');
  url.searchParams.set('email', 'support@dataleap.tech');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`PubMed API error: ${res.status}`);
  }

  return res.json();
}

async function searchPubMed(query, retmax = 25) {
  const data = await ncbiFetch('esearch.fcgi', {
    db: 'pubmed',
    term: query,
    retmax: String(retmax),
    retmode: 'json',
    sort: 'relevance',
  });

  return data.esearchresult?.idlist || [];
}

async function fetchSummaries(ids) {
  if (!ids.length) return [];

  const data = await ncbiFetch('esummary.fcgi', {
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'json',
  });

  const result = data.result || {};
  const uids = result.uids || [];

  return uids
    .map((uid) => {
      const item = result[uid];
      if (!item || item.error) return null;

      const title = item.title?.replace(/\.$/, '') || 'Unknown';
      const herbName = extractHerbName(title);

      return {
        name: herbName,
        latin_name: extractLatinName(title),
        description: buildDescription(item),
        composition: null,
        origin: 'Literature (PubMed)',
        source_type: 'pubmed',
        source_id: uid,
        source_url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
        raw_metadata: {
          title: item.title,
          authors: item.authors?.map((a) => a.name) || [],
          pubdate: item.pubdate,
          journal: item.fulljournalname || item.source,
          query_context: 'pubmed',
        },
      };
    })
    .filter(Boolean);
}

function extractHerbName(title) {
  const cleaned = title
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/\s*:\s*.+$/, '')
    .replace(/\s*[-–—]\s*.+$/, '')
    .trim();

  const plantMatch = cleaned.match(
    /([A-Z][a-z]+(?:\s+[a-z]+){0,2})\s*\(([A-Z][a-z]+\s+[a-z]+)\)/
  );
  if (plantMatch) {
    return plantMatch[2];
  }

  if (cleaned.length > 120) {
    return cleaned.slice(0, 117) + '...';
  }

  return cleaned || title.slice(0, 120);
}

function extractLatinName(title) {
  const match = title.match(/\(([A-Z][a-z]+\s+[a-z]+)\)/);
  return match ? match[1] : null;
}

function buildDescription(item) {
  const parts = [];
  if (item.title) parts.push(item.title);
  if (item.fulljournalname || item.source) {
    parts.push(`Journal: ${item.fulljournalname || item.source}`);
  }
  if (item.pubdate) parts.push(`Published: ${item.pubdate}`);
  if (item.authors?.length) {
    parts.push(`Authors: ${item.authors.slice(0, 3).map((a) => a.name).join(', ')}`);
  }
  return parts.join('\n\n');
}

export async function scrapePubMed({ maxPerQuery = 20 } = {}) {
  const seen = new Set();
  const records = [];

  for (const query of SEARCH_QUERIES) {
    const ids = await searchPubMed(query, maxPerQuery);
    await sleep(350);

    if (!ids.length) continue;

    const summaries = await fetchSummaries(ids);
    await sleep(350);

    for (const record of summaries) {
      const key = `${record.source_type}:${record.source_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ ...record, raw_metadata: { ...record.raw_metadata, search_query: query } });
    }
  }

  return records;
}
