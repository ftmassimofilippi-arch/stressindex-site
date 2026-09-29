import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'

export const runtime = 'edge'
export const alt = 'Stress Index'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const badgeStyle = {
  display: 'flex',
  padding: '8px 16px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.18)',
  border: '1px solid rgba(255,255,255,0.3)',
} as const

export default async function OpenGraphImage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  const badges = [t('og.badgeScores'), t('og.badgeParams'), t('og.badgeReport')]

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background:
            'linear-gradient(135deg, #2E746C 0%, #4FA39A 55%, #8DC5BF 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.35)',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path
                d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.5px',
            }}
          >
            Stress Index
          </div>
        </div>

        <div
          style={{
            fontSize: '108px',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-2px',
            maxWidth: '950px',
            marginBottom: '24px',
          }}
        >
          Stress Index
        </div>

        <div
          style={{
            fontSize: '44px',
            fontWeight: 500,
            opacity: 0.95,
            letterSpacing: '-0.5px',
          }}
        >
          {t('og.tagline')}
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            alignItems: 'center',
            fontSize: '28px',
            opacity: 0.9,
            fontWeight: 500,
          }}
        >
          <div>stressindex.io</div>
          <div
            style={{
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              fontSize: '22px',
              opacity: 0.95,
            }}
          >
            {badges.map((b) => (
              <span key={b} style={badgeStyle}>
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
