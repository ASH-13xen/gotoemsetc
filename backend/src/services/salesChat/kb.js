const SalesKbDoc = require('../../models/SalesKbDoc');
const { SALES_KB_TYPE, SALES_KB_STATUS } = require('../../config/constants');
const logger = require('../../utils/logger');

const CASE_BODY_LIMIT = 600;
const OFFER_BODY_LIMIT = 400;

function trim(str, n) {
  if (!str) return '';
  return str.length > n ? `${str.slice(0, n).trimEnd()}…` : str;
}

function escapeRx(s) {
  return `${s}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Backs the search_case_studies tool. Text index first; if it finds nothing
// (or the index isn't built yet), fall back to a loose industry/service/tag
// regex so the bot still gets something relevant.
async function searchCaseStudies({ industry, service, need } = {}, limit = 3) {
  const terms = [industry, service, need].filter(Boolean).join(' ').trim();
  const base = { type: SALES_KB_TYPE.CASE_STUDY, status: SALES_KB_STATUS.ACTIVE };

  let docs = [];
  if (terms) {
    try {
      docs = await SalesKbDoc.find(
        { ...base, $text: { $search: terms } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();
    } catch (err) {
      logger.warn({ err: err.message }, 'salesChat kb: $text search failed, falling back to regex');
    }
  }

  if (!docs.length) {
    const needles = [industry, service, need]
      .filter(Boolean)
      .map((t) => new RegExp(escapeRx(t), 'i'));
    const or = needles.length
      ? { $or: [{ industry: { $in: needles } }, { services: { $in: needles } }, { tags: { $in: needles } }] }
      : {};
    docs = await SalesKbDoc.find({ ...base, ...or })
      .sort({ order: 1, updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  return docs.map((d) => ({
    title: d.title,
    industry: d.industry || [],
    services: d.services || [],
    summary: d.summary || '',
    detail: trim(d.body, CASE_BODY_LIMIT),
    outcome: d.outcome || '',
    link: d.link || '',
  }));
}

// Backs the get_offers tool. Small set, returned in order.
async function getOffers(limit = 25) {
  const docs = await SalesKbDoc.find({
    type: { $in: [SALES_KB_TYPE.OFFER, SALES_KB_TYPE.SERVICE] },
    status: SALES_KB_STATUS.ACTIVE,
  })
    .sort({ order: 1, title: 1 })
    .limit(limit)
    .lean();

  return docs.map((d) => ({
    title: d.title,
    kind: d.type,
    forIndustries: d.industry || [],
    services: d.services || [],
    summary: d.summary || '',
    detail: trim(d.body, OFFER_BODY_LIMIT),
    link: d.link || '',
  }));
}

// Lowercased sets of every industry / service the KB knows about — the
// scorer uses these to tell "matches something we've actually done" from
// "named an industry". Cached briefly; the KB changes rarely.
let catalogCache = { at: 0, value: null };
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function getCatalog() {
  if (catalogCache.value && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.value;
  }
  const docs = await SalesKbDoc.find(
    { status: SALES_KB_STATUS.ACTIVE },
    { industry: 1, services: 1 }
  ).lean();
  const industries = new Set();
  const services = new Set();
  for (const d of docs) {
    (d.industry || []).forEach((i) => i && industries.add(`${i}`.toLowerCase()));
    (d.services || []).forEach((s) => s && services.add(`${s}`.toLowerCase()));
  }
  catalogCache = { at: Date.now(), value: { industries, services } };
  return catalogCache.value;
}

module.exports = { searchCaseStudies, getOffers, getCatalog };
