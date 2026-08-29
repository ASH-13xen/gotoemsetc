import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';
import ContactCapture from './ContactCapture.jsx';
import { startSession, streamMessage, requestHandoff } from '../lib/api.js';
import { getAnonId, getAttribution } from '../lib/anonId.js';

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hintFor(names = []) {
  if (names.includes('search_case_studies')) return 'Looking up relevant work…';
  if (names.includes('get_offers')) return 'Checking current packages…';
  if (names.includes('request_human_handoff')) return 'Flagging this for the team…';
  return 'Thinking…';
}

// The primary element of the landing page (see the build plan, §4.1-4.3).
// Owns the whole discovery-turn lifecycle: session bootstrap, streaming a
// reply token-by-token over SSE, and the two escape hatches (explicit
// "talk to a human", and whatever the bot's own next action calls for).
export default function ChatWidget({ companyName, onSwitchToForm }) {
  const [phase, setPhase] = useState('connecting'); // connecting | ready | unavailable
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [toolHint, setToolHint] = useState(null);
  const [meta, setMeta] = useState(null); // { nextAction, status, score, band }
  const [handoffPrompt, setHandoffPrompt] = useState(null); // null | 'human' | 'meeting'
  const [handoffDone, setHandoffDone] = useState(false);
  const [startError, setStartError] = useState('');

  const sessionRef = useRef({ conversationId: null, sessionToken: null });
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await startSession({ anonId: getAnonId(), attribution: getAttribution() });
        if (cancelled) return;
        sessionRef.current = { conversationId: res.conversationId, sessionToken: res.sessionToken };
        setMessages([{ role: 'assistant', content: res.opener, streaming: false }]);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setStartError(err.message || "We couldn't start the chat.");
        setPhase('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, toolHint, handoffPrompt]);

  function updateLastAssistant(patch) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      copy[copy.length - 1] = { ...last, ...patch };
      return copy;
    });
  }

  async function handleSend(e) {
    e?.preventDefault();
    const text = inputValue.trim();
    if (!text || sending || phase !== 'ready') return;

    setInputValue('');
    setSending(true);
    setHandoffPrompt(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '', streaming: true }]);

    const { conversationId, sessionToken } = sessionRef.current;
    const clientMsgId = newId();

    try {
      await streamMessage(conversationId, { sessionToken, text, clientMsgId }, (evt) => {
        if (evt.type === 'token') {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: (last.content || '') + evt.text };
            return copy;
          });
        } else if (evt.type === 'tool') {
          setToolHint(hintFor(evt.names));
        } else if (evt.type === 'done') {
          setToolHint(null);
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: evt.assistantMessage || last.content || '…',
              streaming: false,
            };
            return copy;
          });
          if (!evt.duplicate) {
            setMeta({ nextAction: evt.nextAction, status: evt.status, score: evt.score, band: evt.band });
            setHandoffDone(false);
            if (evt.nextAction === 'offer_meeting') setHandoffPrompt('meeting');
            else if (evt.nextAction === 'offer_handoff') setHandoffPrompt('human');
            else setHandoffPrompt(null);
          }
        } else if (evt.type === 'error') {
          setToolHint(null);
          updateLastAssistant({ content: evt.message || 'Sorry, something went wrong.', streaming: false });
        }
      });
    } catch (err) {
      setToolHint(null);
      updateLastAssistant({ content: err.message || 'Connection lost — please try sending that again.', streaming: false });
    } finally {
      setSending(false);
    }
  }

  async function handleHandoffSubmit(contact) {
    const { conversationId, sessionToken } = sessionRef.current;
    await requestHandoff(conversationId, { sessionToken, contact });
    setHandoffDone(true);
    setHandoffPrompt(null);
    setMeta((m) => ({ ...m, status: 'handoff' }));
  }

  function openHumanHandoff() {
    setHandoffDone(false);
    setHandoffPrompt('human');
  }

  const closed = meta?.status === 'handoff' || meta?.status === 'closed';
  const disqualified = meta?.nextAction === 'disqualify';

  if (phase === 'unavailable') {
    return (
      <div className="panel">
        <div className="form-card">
          <h2>Chat isn't available right now</h2>
          <p>{startError}</p>
          <button type="button" className="primary-btn" onClick={onSwitchToForm} style={{ alignSelf: 'flex-start' }}>
            Use the form instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="who">
          <span className={`dot${phase === 'connecting' ? ' busy' : ''}`} />
          {companyName}
        </div>
        <div className="actions">
          <button type="button" className="ghost-btn" onClick={openHumanHandoff} disabled={phase !== 'ready'}>
            Talk to a human
          </button>
          <button type="button" className="link-btn" onClick={onSwitchToForm}>
            Prefer a form?
          </button>
        </div>
      </div>

      <div className="messages" ref={listRef}>
        {phase === 'connecting' && <div className="system-note">Connecting…</div>}
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} streaming={m.streaming} />
        ))}
        {disqualified && (
          <div className="system-note">This conversation has ended. Thanks for stopping by.</div>
        )}
      </div>

      {toolHint && <div className="tool-hint">{toolHint}</div>}

      {handoffDone && !handoffPrompt && (
        <div className="cta-card">
          <h4>Thanks — you're on the list.</h4>
          <p>A team member will reach out shortly.</p>
        </div>
      )}

      {handoffPrompt === 'meeting' && !handoffDone && (
        <ContactCapture
          title="Want to grab time with the team?"
          description="Leave your details and someone will reach out to schedule it."
          submitLabel="Request a callback"
          onSubmit={handleHandoffSubmit}
          onCancel={() => setHandoffPrompt(null)}
        />
      )}

      {handoffPrompt === 'human' && !handoffDone && (
        <ContactCapture
          title="Get a teammate on this"
          description="Leave your details and someone will follow up directly."
          submitLabel="Request a callback"
          onSubmit={handleHandoffSubmit}
          onCancel={() => setHandoffPrompt(null)}
        />
      )}

      {closed && !handoffPrompt ? (
        <div className="closed-note">This chat has been handed to the team — they'll be in touch.</div>
      ) : (
        <form className="composer" onSubmit={handleSend}>
          <textarea
            rows={1}
            value={inputValue}
            disabled={phase !== 'ready' || disqualified}
            placeholder={phase === 'ready' ? 'Type a message…' : 'Connecting…'}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSend(e);
            }}
          />
          <button type="submit" className="send-btn" disabled={phase !== 'ready' || sending || !inputValue.trim() || disqualified}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
