const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

export function startSession(body) {
  return request('/sales-chat/session', { method: 'POST', body: JSON.stringify(body) });
}

export function requestHandoff(conversationId, body) {
  return request(`/sales-chat/session/${conversationId}/handoff`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitFallbackForm(body) {
  return request('/sales-chat/fallback-form', { method: 'POST', body: JSON.stringify(body) });
}

// Streams one assistant reply. A POST body can't use EventSource (GET-only),
// so this reads the fetch response body directly and splits it on the blank
// line that separates SSE frames, calling onEvent for each `data: {...}`
// payload the backend writes (see salesChat.controller.js#postMessage).
export async function streamMessage(conversationId, { sessionToken, text, clientMsgId }, onEvent) {
  const res = await fetch(`${API_BASE}/sales-chat/session/${conversationId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, text, clientMsgId }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to reach the chat.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex = buffer.indexOf('\n\n');
    while (sepIndex !== -1) {
      const frame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (line) {
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          // Malformed frame — skip rather than crash the stream reader.
        }
      }
      sepIndex = buffer.indexOf('\n\n');
    }
  }
}

export { API_BASE };
