const STORAGE_KEY = 'gotofriend_sales_anon_id';

// A first-party, persisted id for an anonymous visitor — carries them until
// they give an email/phone, at which point the backend's identity
// resolution (findOrCreateLead) takes over. localStorage rather than a
// cookie since this app never talks cross-origin-with-credentials.
export function getAnonId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / storage disabled — the session still works, it
    // just won't be recognised on a repeat visit.
    return undefined;
  }
}

// UTM + click-id capture for the Meta feedback loop this will feed later
// (see the build plan, §9 analytics). Purely best-effort — every field is
// optional server-side.
export function getAttribution() {
  const params = new URLSearchParams(window.location.search);
  const pick = (key) => params.get(key) || undefined;
  return {
    utmSource: pick('utm_source'),
    utmMedium: pick('utm_medium'),
    utmCampaign: pick('utm_campaign'),
    fbclid: pick('fbclid'),
    gclid: pick('gclid'),
    referrer: document.referrer || undefined,
    landingPath: window.location.pathname,
  };
}
