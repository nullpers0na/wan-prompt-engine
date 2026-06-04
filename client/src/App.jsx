import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from './components/ChatMessage.jsx';
import ImageMessage from './components/ImageMessage.jsx';
import Sidebar from './components/Sidebar.jsx';
import { createConversation, loadConversation, streamChat } from './api.js';

const CONV_KEY = 'companion_conversations';

const AVATAR_SVG = (
  <svg viewBox="0 0 28 28" fill="none" width="20" height="20">
    <circle cx="14" cy="14" r="3.5" fill="url(#havg)" />
    <path d="M14 3 C14 3 19 8 19 12.5 C19 14 17.5 14 14 14 C10.5 14 9 14 9 12.5 C9 8 14 3 14 3Z" fill="url(#havg)" opacity="0.9"/>
    <path d="M25 14 C25 14 20 19 16 19 C14.5 19 14 17.5 14 14 C14 10.5 14.5 9 16 9 C20 9 25 14 25 14Z" fill="url(#havg)" opacity="0.75"/>
    <path d="M14 25 C14 25 9 20 9 16 C9 14.5 10.5 14 14 14 C17.5 14 19 14.5 19 16 C19 20 14 25 14 25Z" fill="url(#havg)" opacity="0.9"/>
    <path d="M3 14 C3 14 8 9 12 9 C13.5 9 14 10.5 14 14 C14 17.5 13.5 19 12 19 C8 19 3 14 3 14Z" fill="url(#havg)" opacity="0.75"/>
    <defs>
      <linearGradient id="havg" x1="3" y1="3" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fef3c7"/><stop offset="0.5" stopColor="#f59e0b"/><stop offset="1" stopColor="#d97706"/>
      </linearGradient>
    </defs>
  </svg>
);

const PERSONA_NAME = import.meta.env.VITE_PERSONA_NAME || 'Companion';

function getLocalConvs() {
  try { return JSON.parse(localStorage.getItem(CONV_KEY) || '[]'); } catch { return []; }
}
function setLocalConvs(list) {
  try { localStorage.setItem(CONV_KEY, JSON.stringify(list)); } catch {}
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [convId, setConvId] = useState(null);
  const [conversations, setConversations] = useState(getLocalConvs);
  const [messages, setMessages] = useState([]);
  const [streamText, setStreamText] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);
  const abortRef  = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText, pendingImages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [convId]);

  // Load conversation from DB when convId changes
  useEffect(() => {
    if (!convId) return;
    loadConversation(convId).then(data => {
      setMessages(data.messages || []);
    }).catch(() => {});
  }, [convId]);

  const upsertLocalConv = useCallback((id, title, updatedAt) => {
    setConversations(prev => {
      const existing = prev.findIndex(c => c.id === id);
      const entry = { id, title: title || 'Chat', updated_at: updatedAt || Date.now() };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], ...entry };
        setLocalConvs(next);
        return next;
      }
      const next = [entry, ...prev];
      setLocalConvs(next);
      return next;
    });
  }, []);

  async function startNewConversation(firstMessage) {
    const title = firstMessage?.slice(0, 60) || 'New conversation';
    const conv = await createConversation(title);
    setConvId(conv.id);
    upsertLocalConv(conv.id, title, conv.created_at);
    return conv.id;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    setLoading(true);

    let activeConvId = convId;
    if (!activeConvId) {
      try {
        activeConvId = await startNewConversation(text);
      } catch (err) {
        setError('Failed to create conversation: ' + err.message);
        setLoading(false);
        return;
      }
    }

    // Optimistically add user message
    const userMsg = { role: 'user', type: 'text', content: text, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    // Placeholder for streaming assistant response
    const placeholderId = Date.now() + 1;
    setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', type: 'text', content: '', streaming: true }]);
    setStreamText('');

    let assembled = '';

    abortRef.current = streamChat(activeConvId, text, {
      onToken(text) {
        assembled += text;
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: assembled } : m
        ));
      },
      onDone(finalText) {
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: finalText || assembled, streaming: false } : m
        ));
        upsertLocalConv(activeConvId, undefined, Date.now());
        setLoading(false);
      },
      onError(msg) {
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
        setError(msg);
        setLoading(false);
      },
      onImageStart(description) {
        setPendingImages(prev => [...prev, { description, id: Date.now() }]);
      },
      onImageDone(data) {
        // Replace the last pending image placeholder with the real image
        setPendingImages(prev => prev.slice(0, -1));
        const imgMsg = {
          id: Date.now(),
          role: 'assistant',
          type: 'image',
          content: JSON.stringify({ base64: data.base64, mimeType: data.mimeType, prompt: data.prompt }),
        };
        setMessages(prev => [...prev, imgMsg]);
      },
      onImageError(msg) {
        setPendingImages(prev => prev.slice(0, -1));
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'assistant', type: 'error',
          content: `Image generation failed: ${msg}`,
        }]);
      },
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) sendMessage();
    }
  }

  function handleSelectConv(id) {
    if (abortRef.current) abortRef.current();
    setLoading(false);
    setPendingImages([]);
    setError(null);
    setConvId(id);
    setSidebarOpen(false);
  }

  function handleNewConv() {
    if (abortRef.current) abortRef.current();
    setLoading(false);
    setPendingImages([]);
    setError(null);
    setConvId(null);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  const canSend = input.trim().length > 0 && !loading;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Background atmosphere */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
      }}>
        <style>{`
          @keyframes driftA { from { transform: translateX(-55%) translateY(0); } to { transform: translateX(-45%) translateY(50px); } }
          @keyframes driftB { from { transform: translate(0,0); } to { transform: translate(-50px,-80px); } }
        `}</style>
        <div style={{
          position: 'absolute', width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(146,64,14,0.16) 0%, transparent 65%)',
          top: '-250px', left: '50%',
          animation: 'driftA 22s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 65%)',
          bottom: '-80px', right: '-80px',
          animation: 'driftB 28s ease-in-out infinite alternate',
        }} />
      </div>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={convId}
        onSelect={handleSelectConv}
        onNew={handleNewConv}
      />

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(26,18,8,0.92)',
        backdropFilter: 'blur(10px)',
      }}>
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: '6px', borderRadius: '8px',
            display: 'flex', alignItems: 'center',
            transition: 'color 0.2s',
          }}
          title="Conversations"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div style={{
          width: '36px', height: '36px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '10px',
        }}>
          {AVATAR_SVG}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.25rem', fontWeight: 400, fontStyle: 'italic',
            background: 'linear-gradient(135deg, #fef3c7 20%, #fcd34d 60%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            display: 'block', lineHeight: 1.2,
          }}>
            {PERSONA_NAME}
          </span>
          <span style={{
            fontSize: '0.63rem', color: 'var(--text-dim)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            AI Companion
          </span>
        </div>

        <button
          onClick={handleNewConv}
          style={{
            fontFamily: 'inherit',
            fontSize: '0.75rem', fontWeight: 500,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', borderRadius: '8px',
            padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          New chat
        </button>
      </header>

      {/* Chat area */}
      <main style={{
        position: 'relative', zIndex: 1, flex: 1,
        overflowY: 'auto', padding: '20px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: '18px',
        scrollBehavior: 'smooth',
      }}>
        <div style={{
          width: '100%', maxWidth: '760px', margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              color: 'var(--text-dim)', lineHeight: 1.7,
            }}>
              <div style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '1.6rem', fontStyle: 'italic',
                color: 'rgba(245,158,11,0.4)',
                marginBottom: '10px',
              }}>
                {PERSONA_NAME}
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                Start a conversation.
              </div>
            </div>
          )}

          {messages.map(msg => {
            if (msg.type === 'error') {
              return (
                <div key={msg.id} style={{
                  padding: '10px 14px',
                  background: 'rgba(252,165,165,0.07)',
                  border: '1px solid rgba(252,165,165,0.2)',
                  borderRadius: '10px',
                  fontSize: '0.82rem', color: '#fca5a5',
                  maxWidth: '85%',
                }}>
                  ⚠ {msg.content}
                </div>
              );
            }
            return (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                type={msg.type}
                content={msg.content}
                streaming={msg.streaming}
              />
            );
          })}

          {/* Pending image placeholders */}
          {pendingImages.map(p => (
            <div key={p.id} style={{ display: 'flex' }}>
              <ImageMessage generating description={p.description} />
            </div>
          ))}

          {/* Error banner */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px',
              background: 'rgba(252,165,165,0.07)',
              border: '1px solid rgba(252,165,165,0.2)',
              borderRadius: '10px', fontSize: '0.82rem', color: '#fca5a5',
            }}>
              <span>⚠ {error}</span>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'none', border: 'none', color: '#fca5a5',
                  cursor: 'pointer', fontSize: '0.9rem',
                }}
              >✕</button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input dock */}
      <div style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        padding: '10px 16px 14px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(26,18,8,0.95)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          width: '100%', maxWidth: '760px', margin: '0 auto',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '8px 8px 8px 14px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Say something…"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.95rem', lineHeight: 1.55, resize: 'none',
                padding: '3px 0', maxHeight: '140px', overflowY: 'auto',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!canSend}
              style={{
                flexShrink: 0,
                background: canSend
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'rgba(245,158,11,0.1)',
                border: 'none',
                color: canSend ? '#1a1208' : 'rgba(245,158,11,0.3)',
                borderRadius: '9px',
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: canSend ? '0 2px 12px rgba(245,158,11,0.3)' : 'none',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div style={{
            textAlign: 'center', fontSize: '0.63rem',
            color: 'var(--text-dim)', letterSpacing: '0.04em',
            marginTop: '6px',
          }}>
            Enter to send &middot; Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
