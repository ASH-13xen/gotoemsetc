import { useState } from 'react';
import ChatWidget from './components/ChatWidget.jsx';
import FallbackForm from './components/FallbackForm.jsx';

const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'GO-TO';

export default function App() {
  const [mode, setMode] = useState('chat'); // 'chat' | 'form'

  return (
    <div className="shell">
      <header className="hero">
        <div className="brand">{COMPANY_NAME}</div>
        <h1>Tell us what you're trying to grow.</h1>
        <p>
          A couple of quick questions and we'll point you to the right next step — or get you straight
          on the team's calendar.
        </p>
      </header>

      {mode === 'chat' ? (
        <ChatWidget companyName={COMPANY_NAME} onSwitchToForm={() => setMode('form')} />
      ) : (
        <FallbackForm onBack={() => setMode('chat')} />
      )}

      <p className="foot-note">
        By chatting or submitting this form you agree to be contacted by {COMPANY_NAME} by email or phone
        about your enquiry.
      </p>
    </div>
  );
}
