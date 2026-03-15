import { useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

export default function Privacy() {
  const { colors } = useTheme()
  const navigate = useNavigate()

  const s = {
    page: { minHeight: '100vh', background: colors.bg, padding: '40px 24px' },
    content: { maxWidth: 700, margin: '0 auto' },
    back: { background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: 14, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito, sans-serif' },
    title: { fontFamily: 'Nunito, sans-serif', fontSize: 32, fontWeight: 800, color: colors.text, marginBottom: 8 },
    updated: { fontSize: 13, color: colors.textDim, marginBottom: 32 },
    section: { marginBottom: 28 },
    h2: { fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 12 },
    p: { fontSize: 15, color: colors.textMuted, lineHeight: 1.7, marginBottom: 12 },
    ul: { paddingLeft: 20, marginBottom: 12 },
    li: { fontSize: 15, color: colors.textMuted, lineHeight: 1.7, marginBottom: 6 },
    highlight: { background: colors.accent + '22', border: `1px solid ${colors.accent}44`, borderRadius: 12, padding: 20, marginBottom: 28 },
    highlightTitle: { fontFamily: 'Nunito, sans-serif', fontSize: 15, fontWeight: 700, color: colors.accent, marginBottom: 8 },
  }

  return (
    <div style={s.page}>
      <div style={s.content}>
        <button style={s.back} onClick={() => navigate(-1)}>← Back</button>

        <h1 style={s.title}>Privacy Policy</h1>
        <p style={s.updated}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div style={s.highlight}>
          <div style={s.highlightTitle}>🔒 Our Commitment</div>
          <p style={{ ...s.p, marginBottom: 0 }}>
            Orbit is built for personal and family use. Your data is yours. We don't sell, share, or monetize your personal information.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>What We Collect</h2>
          <p style={s.p}>When you use Orbit, we store:</p>
          <ul style={s.ul}>
            <li style={s.li}><strong>Account info:</strong> Email address for login</li>
            <li style={s.li}><strong>Orbits & check-ins:</strong> The tracking items you create and your daily entries</li>
            <li style={s.li}><strong>Preferences:</strong> Theme settings, notification preferences</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>How We Protect Your Data</h2>
          <ul style={s.ul}>
            <li style={s.li}><strong>Row-Level Security:</strong> Database rules ensure you can only access your own data</li>
            <li style={s.li}><strong>Encryption in transit:</strong> All data is transmitted over HTTPS</li>
            <li style={s.li}><strong>Encryption at rest:</strong> Data is encrypted on our database servers</li>
            <li style={s.li}><strong>No third-party tracking:</strong> We don't use analytics or advertising trackers</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Who Can See Your Data</h2>
          <ul style={s.ul}>
            <li style={s.li}><strong>You:</strong> Full access to all your data</li>
            <li style={s.li}><strong>App administrators:</strong> Technical access for support purposes only, never used without your consent</li>
            <li style={s.li}><strong>No one else:</strong> We don't share or sell data to third parties</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>AI Analysis</h2>
          <p style={s.p}>
            When you use the "AI Analysis" feature, your check-in data is sent to Anthropic's Claude API to generate insights.
            This data is processed according to Anthropic's privacy policy and is not used to train AI models.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Email Reminders</h2>
          <p style={s.p}>
            If you enable email reminders, we use your email address to send daily check-in nudges.
            You can disable this at any time from the dashboard.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Your Rights</h2>
          <p style={s.p}>You can:</p>
          <ul style={s.ul}>
            <li style={s.li}><strong>Access:</strong> View all your data anytime in the app</li>
            <li style={s.li}><strong>Delete:</strong> Remove any orbit or check-in entry</li>
            <li style={s.li}><strong>Export:</strong> Request a copy of your data (contact us)</li>
            <li style={s.li}><strong>Close account:</strong> Delete your account and all associated data</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Contact</h2>
          <p style={s.p}>
            Questions about privacy? Email us at <a href="mailto:privacy@orbityours.com" style={{ color: colors.accent }}>privacy@orbityours.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
