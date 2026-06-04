import React from 'react';
import ImageMessage from './ImageMessage.jsx';

const AVATAR = (
  <svg viewBox="0 0 28 28" fill="none" width="16" height="16">
    <circle cx="14" cy="14" r="3.5" fill="url(#cavg)" />
    <path d="M14 3 C14 3 19 8 19 12.5 C19 14 17.5 14 14 14 C10.5 14 9 14 9 12.5 C9 8 14 3 14 3Z" fill="url(#cavg)" opacity="0.9"/>
    <path d="M25 14 C25 14 20 19 16 19 C14.5 19 14 17.5 14 14 C14 10.5 14.5 9 16 9 C20 9 25 14 25 14Z" fill="url(#cavg)" opacity="0.75"/>
    <path d="M14 25 C14 25 9 20 9 16 C9 14.5 10.5 14 14 14 C17.5 14 19 14.5 19 16 C19 20 14 25 14 25Z" fill="url(#cavg)" opacity="0.9"/>
    <path d="M3 14 C3 14 8 9 12 9 C13.5 9 14 10.5 14 14 C14 17.5 13.5 19 12 19 C8 19 3 14 3 14Z" fill="url(#cavg)" opacity="0.75"/>
    <defs>
      <linearGradient id="cavg" x1="3" y1="3" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fef3c7"/>
        <stop offset="0.5" stopColor="#f59e0b"/>
        <stop offset="1" stopColor="#d97706"/>
      </linearGradient>
    </defs>
  </svg>
);

const enterKeyframes = `
@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
`;

export default function ChatMessage({ role, content, type, streaming }) {
  if (type === 'image' || role === 'assistant-image') {
    let imgData = content;
    if (typeof content === 'string') {
      try { imgData = JSON.parse(content); } catch {}
    }
    return (
      <div style={{ display: 'flex', animation: 'msgIn 0.2s ease' }}>
        <style>{enterKeyframes}</style>
        <ImageMessage
          base64={imgData?.base64}
          mimeType={imgData?.mimeType}
          prompt={imgData?.prompt}
        />
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'msgIn 0.2s ease' }}>
        <style>{enterKeyframes}</style>
        <div style={{
          maxWidth: '80%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#1a1208',
          padding: '10px 15px',
          borderRadius: '16px 16px 4px 16px',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          wordBreak: 'break-word',
          fontWeight: 500,
        }}>
          {content}
        </div>
      </div>
    );
  }

  // assistant text
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', animation: 'msgIn 0.2s ease' }}>
      <style>{enterKeyframes}</style>
      <div style={{
        flexShrink: 0,
        width: '30px', height: '30px', marginTop: '2px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '8px',
      }}>
        {AVATAR}
      </div>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 15px',
        fontSize: '0.9rem',
        lineHeight: 1.65,
        color: 'var(--text)',
        maxWidth: '85%',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        boxShadow: streaming ? '0 0 0 1px rgba(245,158,11,0.2)' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        {content || <TypingDots />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      <style>{`
        @keyframes typingPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--amber-light)',
          display: 'inline-block',
          animation: `typingPulse 1.2s ease-in-out ${delay}s infinite`,
        }} />
      ))}
    </span>
  );
}
