import React from 'react';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginLeft: '40px',
    maxWidth: '320px',
  },
  image: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid rgba(245,158,11,0.25)',
    display: 'block',
  },
  caption: {
    marginTop: '6px',
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
};

const shimmerKeyframes = `
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

export default function ImageMessage({ base64, mimeType, prompt, generating, description }) {
  if (generating) {
    return (
      <div style={styles.wrapper}>
        <style>{shimmerKeyframes}</style>
        <div style={{
          width: '260px',
          height: '260px',
          borderRadius: '12px',
          background: 'linear-gradient(90deg, rgba(245,158,11,0.06) 25%, rgba(245,158,11,0.13) 50%, rgba(245,158,11,0.06) 75%)',
          backgroundSize: '400px 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
          border: '1px solid rgba(245,158,11,0.15)',
        }} />
        <span style={{ ...styles.caption, marginTop: '8px' }}>
          Generating{description ? `: ${description.slice(0, 60)}…` : '…'}
        </span>
      </div>
    );
  }

  const src = `data:${mimeType};base64,${base64}`;
  return (
    <div style={styles.wrapper}>
      <img src={src} alt={prompt || 'Generated image'} style={styles.image} />
      {prompt && <span style={styles.caption}>{prompt.slice(0, 100)}</span>}
    </div>
  );
}
