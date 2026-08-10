import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

const C = {
  bg: '#050508',
  surface: '#0F0F14',
  surfaceAlt: '#111118',
  border: 'rgba(255,255,255,0.07)',
  purple: '#7C3AED',
  lavender: '#A78BFA',
  green: '#10B981',
  white: '#F2F1FF',
  muted: '#8888A8',
  gold: '#F59E0B',
}

const RESULTS = [
  { name: 'Al Tamimi & Company', phone: '+971 4 364 1641', email: 'info@tamimi.com', website: 'www.tamimi.com', rating: 4.9 },
  { name: 'Hadef & Partners LLC', phone: '+971 4 429 2999', email: 'contact@hadefpartners.com', website: 'www.hadefpartners.com', rating: 4.8 },
  { name: 'Gulf Legal Associates', phone: '+971 4 227 8801', email: 'legal@gulflegal.ae', website: 'www.gulflegal.ae', rating: 4.7 },
  { name: 'Dubai Law Group', phone: '+971 4 355 9900', email: 'hello@dubailawgroup.com', website: 'www.dubailawgroup.com', rating: 4.6 },
  { name: 'Emirates Legal Counsel', phone: '+971 4 447 1200', email: 'counsel@emirateslegal.ae', website: 'www.emirateslegal.ae', rating: 4.8 },
  { name: 'Arabian Justice Partners', phone: '+971 4 512 3344', email: 'info@arabianjustice.com', website: 'www.arabianjustice.com', rating: 4.5 },
  { name: 'Al Reem Law Firm', phone: '+971 4 339 8712', email: 'contact@alreemlaw.ae', website: 'www.alreemlaw.ae', rating: 4.7 },
  { name: 'Marina Legal Services', phone: '+971 4 448 9900', email: 'info@marinalegal.ae', website: 'www.marinalegal.ae', rating: 4.6 },
  { name: 'DIFC Law Associates', phone: '+971 4 401 9000', email: 'difc@lawassociates.ae', website: 'www.lawassociates.ae', rating: 4.9 },
  { name: 'Pearl Legal Consultancy', phone: '+971 4 516 8800', email: 'pearl@pearllegal.ae', website: 'www.pearllegal.ae', rating: 4.7 },
]

function fadeIn(frame: number, start: number, duration: number): number {
  return Math.min(1, Math.max(0, (frame - start) / duration))
}

export function MetaAd15() {
  const frame = useCurrentFrame()

  // SEGMENT 1: Results streaming (0 to 180 frames, 6 seconds)
  // SEGMENT 2: CSV export click (180 to 300 frames, 4 seconds)
  // SEGMENT 3: CTA card (300 to 450 frames, 5 seconds)

  const isSegment1 = frame < 180
  const isSegment2 = frame >= 180 && frame < 300
  const isSegment3 = frame >= 300

  // Segment 1 values
  const resultCount = Math.floor(interpolate(frame, [0, 160], [0, 847], { extrapolateRight: 'clamp' }))
  const rowsToShow = Math.min(10, Math.floor(frame / 14))
  const exportBtnOpacity = fadeIn(frame, 140, 20)

  // Segment 2 values
  const downloadProgress = interpolate(frame, [200, 280], [0, 100], { extrapolateRight: 'clamp' })
  const downloadOpacity = fadeIn(frame, 185, 10)
  const successOpacity = fadeIn(frame, 285, 15)

  // Segment 3 values
  const ctaOpacity = fadeIn(frame, 300, 20)
  const headline1Opacity = fadeIn(frame, 310, 15)
  const headline2Opacity = fadeIn(frame, 335, 15)
  const priceOpacity = fadeIn(frame, 360, 15)
  const btnOpacity = fadeIn(frame, 390, 20)
  const urlOpacity = fadeIn(frame, 420, 20)
  const btnPulse = isSegment3 ? Math.sin(frame * 0.15) * 0.02 + 1 : 1

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: 'Inter, sans-serif' }}>

      {/* SEGMENT 1 — Results streaming */}
      {isSegment1 && (
        <AbsoluteFill>

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '16px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${C.border}`,
            background: 'rgba(5,5,8,0.98)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, background: C.purple,
                borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white'
              }}>LT</div>
              <span style={{ fontSize: 17, fontWeight: 800, color: C.white }}>
                Lead<span style={{ color: C.lavender }}>Thur</span>
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 8, padding: '5px 12px'
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: C.green,
                boxShadow: '0 0 6px rgba(16,185,129,0.8)'
              }} />
              <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>
                Searching live...
              </span>
            </div>
          </div>

          {/* Search query display */}
          <div style={{
            position: 'absolute', top: 72, left: 24, right: 24,
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '12px 18px',
            display: 'flex', gap: 16, alignItems: 'center'
          }}>
            <div style={{
              background: '#0A0A10',
              border: `1px solid ${C.purple}`,
              borderRadius: 8, padding: '8px 14px',
              fontSize: 14, color: C.white, fontWeight: 600, flex: 1
            }}>
              Law Firms
            </div>
            <div style={{ color: C.muted, fontSize: 14 }}>in</div>
            <div style={{
              background: '#0A0A10',
              border: `1px solid ${C.purple}`,
              borderRadius: 8, padding: '8px 14px',
              fontSize: 14, color: C.white, fontWeight: 600, flex: 1
            }}>
              Dubai, UAE
            </div>
          </div>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: 160, left: 24, right: 24,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: C.green,
                boxShadow: '0 0 8px rgba(16,185,129,0.6)'
              }} />
              <span style={{ fontSize: 24, fontWeight: 900, color: C.lavender }}>
                {resultCount.toLocaleString()}
              </span>
              <span style={{ fontSize: 14, color: C.muted }}>businesses found</span>
            </div>
            <div style={{
              opacity: exportBtnOpacity,
              background: C.green, color: 'white',
              padding: '7px 16px', borderRadius: 8,
              fontSize: 12, fontWeight: 700
            }}>
              Export CSV
            </div>
          </div>

          {/* Results table */}
          <div style={{
            position: 'absolute', top: 210, left: 24, right: 24, bottom: 24,
            background: C.surface,
            border: `1px solid rgba(124,58,237,0.2)`,
            borderRadius: 12, overflow: 'hidden'
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 160px 80px',
              padding: '8px 16px',
              background: '#0A0A10',
              borderBottom: `1px solid ${C.border}`
            }}>
              {['BUSINESS NAME', 'PHONE', 'EMAIL', 'RATING'].map(h => (
                <div key={h} style={{
                  fontSize: 9, fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.07em'
                }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {RESULTS.slice(0, rowsToShow).map((r, i) => {
              const rowOpacity = fadeIn(frame, i * 14, 10)
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 160px 80px',
                  padding: '10px 16px',
                  borderBottom: `1px solid rgba(255,255,255,0.04)`,
                  background: i % 2 === 0 ? C.surface : '#0D0D12',
                  opacity: rowOpacity
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: C.green, fontWeight: 500 }}>{r.phone}</div>
                  <div style={{ fontSize: 11, color: C.lavender }}>{r.email}</div>
                  <div style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>★ {r.rating}</div>
                </div>
              )
            })}
          </div>

        </AbsoluteFill>
      )}

      {/* SEGMENT 2 — CSV Export */}
      {isSegment2 && (
        <AbsoluteFill style={{ opacity: downloadOpacity }}>

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '16px 24px',
            display: 'flex', alignItems: 'center',
            borderBottom: `1px solid ${C.border}`,
            background: 'rgba(5,5,8,0.98)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, background: C.purple,
                borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white'
              }}>LT</div>
              <span style={{ fontSize: 17, fontWeight: 800, color: C.white }}>
                Lead<span style={{ color: C.lavender }}>Thur</span>
              </span>
            </div>
          </div>

          {/* Export dialog centered */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 36,
            width: 480,
            boxShadow: '0 40px 80px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>
              Exporting your contacts
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              leadthur-law-firms-dubai-uae.csv
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 100, height: 8, marginBottom: 12, overflow: 'hidden'
            }}>
              <div style={{
                width: `${downloadProgress}%`,
                height: '100%', background: C.green,
                borderRadius: 100,
                boxShadow: '0 0 10px rgba(16,185,129,0.5)'
              }} />
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              {downloadProgress < 100
                ? `Exporting ${Math.floor(downloadProgress * 8.47)} of 847 contacts...`
                : '847 contacts exported'
              }
            </div>

            {frame > 285 && (
              <div style={{
                opacity: successOpacity,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                  File saved to Downloads
                </span>
              </div>
            )}
          </div>

        </AbsoluteFill>
      )}

      {/* SEGMENT 3 — CTA */}
      {isSegment3 && (
        <AbsoluteFill style={{
          opacity: ctaOpacity,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 60px'
        }}>

          {/* Glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700, height: 700,
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 65%)',
            pointerEvents: 'none'
          }} />

          {/* Logo */}
          <div style={{
            opacity: headline1Opacity,
            display: 'flex', alignItems: 'center',
            gap: 10, marginBottom: 28
          }}>
            <div style={{
              width: 44, height: 44, background: C.purple,
              borderRadius: 11, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white'
            }}>LT</div>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.white }}>
              Lead<span style={{ color: C.lavender }}>Thur</span>
            </span>
          </div>

          {/* Headline */}
          <div style={{
            opacity: headline1Opacity,
            fontSize: 52, fontWeight: 900, letterSpacing: -2,
            color: C.white, lineHeight: 1.05, marginBottom: 16
          }}>
            Stop searching.
          </div>
          <div style={{
            opacity: headline2Opacity,
            fontSize: 52, fontWeight: 900, letterSpacing: -2,
            color: C.lavender, lineHeight: 1.05, marginBottom: 24
          }}>
            Start closing.
          </div>

          {/* Price */}
          <div style={{
            opacity: priceOpacity,
            display: 'flex', alignItems: 'center',
            gap: 20, marginBottom: 36
          }}>
            <div style={{
              fontSize: 15, color: '#555570',
              textDecoration: 'line-through'
            }}>Apollo: $588/yr</div>
            <div style={{ fontSize: 15, color: C.muted }}>vs</div>
            <div style={{ fontSize: 18, color: C.white, fontWeight: 800 }}>
              LeadThur: <span style={{ color: C.green }}>$25 once</span>
            </div>
          </div>

          {/* CTA Button */}
          <div style={{
            opacity: btnOpacity,
            background: C.purple, color: 'white',
            padding: '18px 48px', borderRadius: 14,
            fontSize: 18, fontWeight: 800,
            boxShadow: '0 0 60px rgba(124,58,237,0.55)',
            transform: `scale(${btnPulse})`,
            marginBottom: 16
          }}>
            Get Lifetime Access — $25
          </div>

          <div style={{
            opacity: urlOpacity,
            fontSize: 14, color: C.muted
          }}>
            leadthur.com · Try free before you pay
          </div>

        </AbsoluteFill>
      )}

    </AbsoluteFill>
  )
}
