import { useState } from 'react';
import { submitFallbackForm } from '../lib/api.js';
import { getAnonId, getAttribution } from '../lib/anonId.js';

// The full escape hatch — "Prefer a form?" from the chat panel, or the
// landing state if the chat can't start at all (see App.jsx). Always
// available regardless of whether the bot itself is configured/working.
export default function FallbackForm({ onBack }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const canSubmit = (form.email.trim() || form.phone.trim()) && !busy;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await submitFallbackForm({
        anonId: getAnonId(),
        attribution: getAttribution(),
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="panel">
        <div className="success-card">
          <div className="check">✓</div>
          <h2>Got it.</h2>
          <p style={{ color: 'var(--ink-soft)', margin: 0 }}>
            Someone from the team will reach out shortly. Thanks for your patience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>Tell us a bit about you</h2>
        <p>We'll have someone from the team follow up directly.</p>

        <div className="field-row">
          <div className="field">
            <label htmlFor="ff-name">Name</label>
            <input id="ff-name" value={form.name} onChange={set('name')} placeholder="Your name" />
          </div>
          <div className="field">
            <label htmlFor="ff-company">Company / brand</label>
            <input id="ff-company" value={form.company} onChange={set('company')} placeholder="Optional" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="ff-email">Email</label>
            <input id="ff-email" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" />
          </div>
          <div className="field">
            <label htmlFor="ff-phone">Phone</label>
            <input id="ff-phone" value={form.phone} onChange={set('phone')} placeholder="+91…" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ff-message">What are you looking for? (optional)</label>
          <textarea id="ff-message" rows={3} value={form.message} onChange={set('message')} />
        </div>

        {error && <div className="error-note">{error}</div>}

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button type="submit" className="primary-btn" disabled={!canSubmit}>
            {busy ? 'Sending…' : 'Send'}
          </button>
          {onBack && (
            <button type="button" className="link-btn" onClick={onBack}>
              ← Back to chat
            </button>
          )}
        </div>
        {!form.email.trim() && !form.phone.trim() && (
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', margin: 0 }}>
            An email or phone number is needed so someone can reach you.
          </p>
        )}
      </form>
    </div>
  );
}
