import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

function generateToken() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

export default function ShareOrbit({ orbit, userId, onClose }) {
  const { colors } = useTheme()
  const [token, setToken] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [lastUsedAt, setLastUsedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  const shareUrl = token ? `${window.location.origin}/checkin/${token}` : null

  useEffect(() => {
    loadToken()
  }, [orbit.id])

  const loadToken = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orbit_share_tokens')
      .select('token, expires_at, last_used_at')
      .eq('orbit_id', orbit.id)
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setToken(data.token)
      setExpiresAt(data.expires_at)
      setLastUsedAt(data.last_used_at)
    }
    setLoading(false)
  }

  const createToken = async () => {
    setSaving(true)
    const newToken = generateToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)

    const { error } = await supabase.from('orbit_share_tokens').insert({
      orbit_id: orbit.id,
      owner_user_id: userId,
      token: newToken,
      expires_at: expires.toISOString(),
    })

    if (!error) {
      setToken(newToken)
      setExpiresAt(expires.toISOString())
      setLastUsedAt(null)
    }
    setSaving(false)
  }

  const regenerateToken = async () => {
    setSaving(true)
    // Delete old tokens for this orbit
    await supabase
      .from('orbit_share_tokens')
      .delete()
      .eq('orbit_id', orbit.id)
      .eq('owner_user_id', userId)

    const newToken = generateToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)

    const { error } = await supabase.from('orbit_share_tokens').insert({
      orbit_id: orbit.id,
      owner_user_id: userId,
      token: newToken,
      expires_at: expires.toISOString(),
    })

    if (!error) {
      setToken(newToken)
      setExpiresAt(expires.toISOString())
      setLastUsedAt(null)
    }
    setConfirmRegen(false)
    setSaving(false)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
    modal: { background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 24, padding: '32px 28px', maxWidth: 480, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
    title: { fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.textDim, lineHeight: 1.5 },
    closeBtn: { background: 'none', border: 'none', color: colors.textDim, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4, marginTop: -4 },
    orbitPill: { display: 'inline-flex', alignItems: 'center', gap: 8, background: colors.border, borderRadius: 12, padding: '8px 14px', fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 24 },
    infoBox: { background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 20 },
    linkRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
    linkText: { flex: 1, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: colors.textMuted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    copyBtn: { background: copied ? '#22c55e' : colors.accent, border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s', fontFamily: 'Nunito, sans-serif', flexShrink: 0 },
    metaRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
    metaItem: { fontSize: 12, color: colors.textDim },
    metaVal: { color: colors.textMuted, fontWeight: 600 },
    generateBtn: { width: '100%', background: colors.accentGradient, border: 'none', borderRadius: 14, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', opacity: saving ? 0.7 : 1 },
    regenBtn: { background: 'none', border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 14px', color: colors.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', width: '100%', marginTop: 10 },
    confirmBox: { background: '#f59e0b0f', border: '1px solid #f59e0b44', borderRadius: 12, padding: '14px 16px', marginTop: 10 },
    confirmText: { fontSize: 13, color: '#f59e0b', marginBottom: 12, lineHeight: 1.5 },
    confirmBtns: { display: 'flex', gap: 10 },
    confirmYes: { flex: 1, background: '#f59e0b', border: 'none', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', opacity: saving ? 0.7 : 1 },
    confirmNo: { flex: 1, background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px', color: colors.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' },
    howTo: { background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '16px 18px', marginTop: 20 },
    howToTitle: { fontSize: 13, fontWeight: 700, color: colors.textMuted, marginBottom: 10 },
    step: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    stepNum: { width: 20, height: 20, borderRadius: '50%', background: colors.accent + '22', color: colors.accent, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    stepText: { fontSize: 13, color: colors.textDim, lineHeight: 1.5 },
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Share Orbit</div>
            <div style={s.subtitle}>Send a link to family members so they can check in — no account needed.</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.orbitPill}>
          <span>{orbit.icon}</span>
          <span>{orbit.name}</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: colors.textDim, fontSize: 14 }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            Loading...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : token ? (
          <>
            <div style={s.infoBox}>
              <div style={s.linkRow}>
                <div style={s.linkText}>{shareUrl}</div>
                <button style={s.copyBtn} onClick={copyLink}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div style={s.metaRow}>
                <div style={s.metaItem}>
                  Expires: <span style={s.metaVal}>{new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {lastUsedAt && (
                  <div style={s.metaItem}>
                    Last used: <span style={s.metaVal}>{new Date(lastUsedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>

            {!confirmRegen ? (
              <button style={s.regenBtn} onClick={() => setConfirmRegen(true)}>
                🔄 Regenerate link (invalidates old link)
              </button>
            ) : (
              <div style={s.confirmBox}>
                <div style={s.confirmText}>
                  ⚠️ This will invalidate the existing link. Anyone using it will need the new one.
                </div>
                <div style={s.confirmBtns}>
                  <button style={s.confirmYes} onClick={regenerateToken} disabled={saving}>
                    {saving ? 'Regenerating...' : 'Yes, regenerate'}
                  </button>
                  <button style={s.confirmNo} onClick={() => setConfirmRegen(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button style={s.generateBtn} onClick={createToken} disabled={saving}>
            {saving ? 'Generating...' : '🔗 Generate Share Link'}
          </button>
        )}

        <div style={s.howTo}>
          <div style={s.howToTitle}>How it works</div>
          <div style={s.step}>
            <div style={s.stepNum}>1</div>
            <div style={s.stepText}>Copy the link and send it to a family member (WhatsApp, iMessage, etc.)</div>
          </div>
          <div style={s.step}>
            <div style={s.stepNum}>2</div>
            <div style={s.stepText}>They open the link and see the check-in form — no login required</div>
          </div>
          <div style={s.step}>
            <div style={s.stepNum}>3</div>
            <div style={{ ...s.stepText, marginBottom: 0 }}>Their check-ins show up in your dashboard, under your account</div>
          </div>
        </div>
      </div>
    </div>
  )
}
