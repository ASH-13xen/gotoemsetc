import { useState } from 'react';

// Small inline form used both for the "talk to a human" escape hatch and
// for the offer_meeting / offer_handoff prompts the bot's next action can
// trigger. Calendar booking isn't built yet — this just gets a human the
// contact detail they need to follow up.
export default function ContactCapture({ title, description, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = (email.trim() || phone.trim()) && !busy;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form className="cta-card" onSubmit={handleSubmit}>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      <div className="field-row">
        <div className="field">
          <label htmlFor="cc-name">Name</label>
          <input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="field">
          <label htmlFor="cc-email">Email</label>
          <input
            id="cc-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cc-phone">Phone (optional if you gave an email)</label>
        <input id="cc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
      </div>
      {error && <div className="error-note">{error}</div>}
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button type="submit" className="primary-btn" disabled={!canSubmit}>
          {busy ? 'Sending…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Not now
          </button>
        )}
      </div>
    </form>
  );
}
