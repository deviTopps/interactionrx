import { scrapePubMed } from './pubmed.js';
import { scrapeWikidata } from './wikidata.js';

export async function runHerbScrapers({ sources = ['pubmed', 'wikidata'] } = {}) {
  const allRecords = [];
  const errors = [];

  if (sources.includes('pubmed')) {
    try {
      const pubmed = await scrapePubMed({ maxPerQuery: 20 });
      allRecords.push(...pubmed);
    } catch (err) {
      errors.push({ source: 'pubmed', message: err.message });
    }
  }

  if (sources.includes('wikidata')) {
    try {
      const wikidata = await scrapeWikidata();
      allRecords.push(...wikidata);
    } catch (err) {
      errors.push({ source: 'wikidata', message: err.message });
    }
  }

  const deduped = dedupeRecords(allRecords);

  return {
    records: deduped,
    errors,
    stats: {
      total: deduped.length,
      pubmed: deduped.filter((r) => r.source_type === 'pubmed').length,
      wikidata: deduped.filter((r) => r.source_type === 'wikidata').length,
    },
  };
}

function dedupeRecords(records) {
  const byKey = new Map();

  for (const record of records) {
    const key = `${record.source_type}:${record.source_id}`;
    if (!byKey.has(key)) {
      byKey.set(key, record);
    }
  }

  return Array.from(byKey.values());
}
