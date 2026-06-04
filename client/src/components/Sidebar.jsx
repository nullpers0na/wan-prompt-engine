import React from 'react';

function formatDate(ts) {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Sidebar({ open, onClose, conversations, activeId, onSelect, onNew }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '280px', maxWidth: '85vw',
        zIndex: 51,
        background: 'rgba(26,18,8,0.98)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            Conversations
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1,
            padding: '2px 6px', transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.target.style.color = 'var(--amber-light)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
          >✕</button>
        </div>

        <button
          onClick={onNew}
          style={{
            margin: '10px 10px 4px',
            padding: '9px 14px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '10px',
            color: 'var(--amber-light)',
            cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 600,
            fontFamily: 'inherit',
            textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
        >
          + New conversation
        </button>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {conversations.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 16px',
              color: 'var(--text-dim)', fontSize: '0.82rem', lineHeight: 1.6,
            }}>
              No conversations yet.
            </div>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid transparent',
                background: c.id === activeId ? 'rgba(245,158,11,0.07)' : 'none',
                borderColor: c.id === activeId ? 'rgba(245,158,11,0.2)' : 'transparent',
                marginBottom: '2px',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.background = 'none'; }}
            >
              <div style={{
                fontSize: '0.84rem', color: 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                lineHeight: 1.4,
              }}>
                {c.title || 'Untitled'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {formatDate(c.updated_at || c.created_at)}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
