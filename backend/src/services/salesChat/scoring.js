const { SALES_SCORE_BAND } = require('../../config/constants');

// ---------------------------------------------------------------------------
// v1 lead score — transparent weighted rules, not a model. Fit (0-50) +
// intent (0-50), minus hard disqualifiers that zero it out. Every branch
// pushes a short human-readable factor so a rep can see why the number is
// what it is. Tune the weights here; a learned model comes much later, once
// there are labelled outcomes to train on.
// ---------------------------------------------------------------------------

const SIZE_POINTS = { solo: 3, '2-10': 6, '11-50': 10, '51-200': 9, '200+': 7 };
const BUDGET_POINTS = [
  { re: /(50|60|70|80|90|100)\s*k|50k\+|lakh|crore|50k\/mo|50\+/i, pts: 16, label: 'budget 50k+/mo' },
  { re: /(25|30|35|40|45)\s*k|25-50/i, pts: 12, label: 'budget 25-50k/mo' },
  { re: /(10|15|20)\s*k|under\s*25/i, pts: 7, label: 'budget 10-25k/mo' },
  { re: /no budget|tight|shoestring|free|cheap/i, pts: 0, label: 'no/low budget stated' },
];
const TIMELINE_POINTS = {
  now: 12,
  'this month': 10,
  'this quarter': 7,
  later: 3,
  'just exploring': 1,
};
const ROLE_POINTS = { decision_maker: 8, influencer: 5, researcher: 1 };
const SIGNAL_POINTS = { ready: 14, considering: 9, curious: 4, none: 0 };

function bandFor(score) {
  if (score >= 80) return SALES_SCORE_BAND.A;
  if (score >= 60) return SALES_SCORE_BAND.B;
  if (score >= 40) return SALES_SCORE_BAND.C;
  return SALES_SCORE_BAND.D;
}

// q: merged qualification object. signals: { buyingSignal, explicitMeetingAsk,
// turnCount, disqualify }. knownIndustries / knownServices: lowercased sets
// pulled from the KB so "matches something we've done" is real, not assumed.
function computeScore(q = {}, signals = {}, catalog = {}) {
  const factors = [];
  const knownIndustries = catalog.industries || new Set();
  const knownServices = catalog.services || new Set();

  // --- Hard disqualifiers: zero it, say why, stop. ---
  if (signals.disqualify && signals.disqualify.isDisqualified) {
    const reason = signals.disqualify.reason || 'not a fit';
    return {
      score: 0,
      band: SALES_SCORE_BAND.D,
      factors: [`Disqualified: ${reason}`],
      disqualified: true,
      disqualifyReason: reason,
    };
  }

  // ---------------- Fit (0-50) ----------------
  let fit = 0;

  const industry = (q.industry || '').toLowerCase().trim();
  if (industry) {
    if ([...knownIndustries].some((k) => k && (industry.includes(k) || k.includes(industry)))) {
      fit += 12;
      factors.push(`Industry we've worked in (${q.industry})`);
    } else {
      fit += 5;
      factors.push(`Industry named (${q.industry})`);
    }
  }

  const size = (q.companySizeBand || '').toLowerCase().trim();
  if (SIZE_POINTS[size] != null) {
    fit += SIZE_POINTS[size];
    factors.push(`Company size ${size}`);
  }

  const budgetText = `${q.budgetBand || ''}`;
  if (budgetText) {
    const hit = BUDGET_POINTS.find((b) => b.re.test(budgetText));
    if (hit) {
      fit += hit.pts;
      factors.push(hit.label);
    } else {
      fit += 6;
      factors.push(`Budget discussed (${q.budgetBand})`);
    }
  }

  const services = (q.services || []).map((s) => `${s}`.toLowerCase().trim()).filter(Boolean);
  if (services.length) {
    const matched = services.filter((s) =>
      [...knownServices].some((k) => k && (s.includes(k) || k.includes(s)))
    );
    const pts = Math.min(12, 4 + matched.length * 4);
    fit += pts;
    factors.push(
      matched.length
        ? `Wants services we offer (${matched.join(', ')})`
        : `Service interest noted (${services.join(', ')})`
    );
  }

  fit = Math.min(50, fit);

  // ---------------- Intent (0-50) ----------------
  let intent = 0;

  if (signals.explicitMeetingAsk) {
    intent += 14;
    factors.push('Asked to meet / talk');
  }

  const timeline = (q.timeline || '').toLowerCase().trim();
  if (TIMELINE_POINTS[timeline] != null) {
    intent += TIMELINE_POINTS[timeline];
    factors.push(`Timeline: ${timeline}`);
  }

  // Engagement depth — a real back-and-forth with specifics beats a one-liner.
  const depth = Math.min(10, (signals.turnCount || 0) * 2 + (q.painPoints || []).length * 2);
  if (depth > 0) {
    intent += depth;
    if (depth >= 6) factors.push('Engaged, specific conversation');
  }

  const hasContact = Boolean((q.email || '').trim() || (q.phone || '').trim());
  if (hasContact) {
    intent += 8;
    factors.push('Shared contact details');
  }

  const sig = signals.buyingSignal || 'none';
  if (SIGNAL_POINTS[sig]) {
    intent += SIGNAL_POINTS[sig];
    if (sig === 'ready' || sig === 'considering') factors.push(`Buying signal: ${sig}`);
  }

  if ((q.objections || []).length >= 2) {
    intent -= 6;
    factors.push('Multiple objections raised');
  }

  intent = Math.max(0, Math.min(50, intent));

  const score = Math.max(0, Math.min(100, Math.round(fit + intent)));
  return {
    score,
    band: bandFor(score),
    factors: factors.slice(0, 5),
    disqualified: false,
    disqualifyReason: null,
  };
}

module.exports = { computeScore, bandFor };
