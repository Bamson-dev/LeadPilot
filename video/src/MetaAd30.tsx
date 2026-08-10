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
  { name: 'Jumeirah Law Office', phone: '+971 4 394 5500', email: 'office@jumeirahlaw.com', website: 'www.jumeirahlaw.com', rating: 4.6 },
  { name: 'Gold Coast Legal Group', phone: '+971 4 288 3300', email: 'legal@goldcoastdubai.ae', website: 'www.goldcoastdubai.ae', rating: 4.8 },
]

function fadeIn(frame: number, start: number, duration: number): number {
  return Math.min(1, Math.max(0, (frame - start) / duration))
}

export function MetaAd30() {
  const frame = useCurrentFrame()

  // SEGMENT 1: Homepage flash (0 to 90, 3 seconds)
  // SEGMENT 2: Search and results (90 to 510, 14 seconds)
  // SEGMENT 3: Results scroll (510 to 690, 6 seconds)
  // SEGMENT 4: Export (690 to 780, 3 seconds)
  // SEGMENT 5: CTA (780 to 900, 4 seconds)

  const isSegment1 = frame < 90
  const isSegment2 = frame >= 90 && frame < 510
  const isSegment3 = frame >= 510 && frame < 690
  const isSegment4 = frame >= 690 && frame < 780
  const isSegment5 = frame >= 780

  // Segment 1
  const heroOpacity = fadeIn(frame, 0, 20)
  const heroFadeOut = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' })

  // Segment 2
  const localS2 = frame - 90
  const businessTypeChars = Math.floor(interpolate(localS2, [10, 50], [0, 9], { extrapolateRight: 'clamp' }))
  const cityChars = Math.floor(interpolate(localS2, [60, 100], [0, 10], { extrapolateRight: 'clamp' }))
  const searchClick = localS2 > 110 && localS2 < 130
  const searchClickScale = interpolate(localS2, [110, 115, 125], [1, 0.92, 1], { extrapolateRight: 'clamp' })
  const resultsStart = 130
  const resultCount = Math.floor(interpolate(localS2, [resultsStart, resultsStart + 280], [0, 847], { extrapolateRight: 'clamp' }))
  const rowsToShow = Math.min(12, Math.max(0, Math.floor((localS2 - resultsStart) / 20)))

  // Segment 3
  const localS3 = frame - 510
  const scrollY = interpolate(localS3, [0, 180], [0, 280], { extrapolateRight: 'clamp' })

  // Segment 4
  const localS4 = frame - 690
  const downloadProgress = interpolate(localS4, [10, 80], [0, 100], { extrapolateRight: 'clamp' })
  const successOpacity = fadeIn(localS4, 82, 10)

  // Segment 5
  const localS5 = frame - 780
  const ctaOpacity = fadeIn(localS5, 0, 20)
  const btn1Opacity = fadeIn(localS5, 20, 15)
  const btn2Opacity = fadeIn(localS5, 50, 15)
  const priceOpacity = fadeIn(localS5, 75, 15)
  const ctaBtnOpacity = fadeIn(localS5, 95, 15)
  const urlOpacity = fadeIn(localS5, 100, 15)
  const btnPulse = isSegment5 ? Math.sin(localS5 * 0.15) * 0.02 + 1 : 1

  const businessTypeText = 'Law Firms'
  const cityText = 'Dubai, UAE'

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: 'Inter, sans-serif' }}>

      {/* SEGMENT 1 — Homepage flash */}
      {isSegment1 && (
        <AbsoluteFill style={{ opacity: heroOpacity * (1 - heroFadeOut) }}>
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

          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', width: '100%', padding: '0 60px'
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.2)',
              padding: '7px 16px', borderRadius: 100,
              fontSize: 12, color: C.lavender, fontWeight: 600, marginBottom: 24
            }}>
              <span style={{ width: 7, height: 7, background: C.green, borderRadius: '50%', display: 'inline-block' }} />
              Live across 195 countries
            </div>
            <div style={{
              fontSize: 54, fontWeight: 900, letterSpacing: -2,
              color: C.white, lineHeight: 1.05, marginBottom: 16
            }}>
              Stop searching<br />for clients.
            </div>
            <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: -2, color: C.lavender }}>
              Find them in 60s.
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* SEGMENT 2 — Search and results */}
      {isSegment2 && (
        <AbsoluteFill>
          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${C.border}`,
            background: 'rgba(5,5,8,0.98)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, background: C.purple,
                borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white'
              }}>LT</div>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>
                Lead<span style={{ color: C.lavender }}>Thur</span>
              </span>
            </div>
            {localS2 > resultsStart && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8, padding: '4px 10px'
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Live results</span>
              </div>
            )}
          </div>

          {/* Search fields */}
          <div style={{
            position: 'absolute', top: 62, left: 24, right: 24,
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', gap: 12, alignItems: 'flex-end'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Business Type</div>
              <div style={{
                background: '#0A0A10',
                border: `1px solid ${localS2 < 55 ? C.purple : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, padding: '8px 12px',
                fontSize: 14, color: C.white, minHeight: 38,
                display: 'flex', alignItems: 'center'
              }}>
                {businessTypeText.substring(0, businessTypeChars)}
                {localS2 < 55 && (
                  <span style={{
                    display: 'inline-block', width: 2, height: 15,
                    background: C.lavender, marginLeft: 1,
                    opacity: Math.floor(localS2 / 12) % 2 === 0 ? 1 : 0
                  }} />
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>City</div>
              <div style={{
                background: '#0A0A10',
                border: `1px solid ${localS2 >= 60 && localS2 < 105 ? C.purple : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, padding: '8px 12px',
                fontSize: 14, color: C.white, minHeight: 38,
                display: 'flex', alignItems: 'center'
              }}>
                {cityText.substring(0, cityChars)}
                {localS2 >= 60 && localS2 < 105 && (
                  <span style={{
                    display: 'inline-block', width: 2, height: 15,
                    background: C.lavender, marginLeft: 1,
                    opacity: Math.floor(localS2 / 12) % 2 === 0 ? 1 : 0
                  }} />
                )}
              </div>
            </div>
            <div style={{
              background: searchClick ? '#9461FA' : C.purple,
              color: 'white', padding: '8px 20px',
              borderRadius: 8, fontSize: 13, fontWeight: 700,
              transform: `scale(${searchClickScale})`,
              boxShadow: searchClick ? '0 0 30px rgba(124,58,237,0.7)' : '0 0 20px rgba(124,58,237,0.4)',
              whiteSpace: 'nowrap'
            }}>
              {localS2 > 130 ? 'Searching...' : 'Search'}
            </div>
          </div>

          {/* Results */}
          {localS2 > resultsStart && (
            <>
              <div style={{
                position: 'absolute', top: 182, left: 24, right: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
                  <span style={{ fontSize: 20, fontWeight: 900, color: C.lavender }}>{resultCount.toLocaleString()}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>businesses found</span>
                </div>
                {localS2 > resultsStart + 260 && (
                  <div style={{
                    background: C.green, color: 'white',
                    padding: '6px 14px', borderRadius: 7,
                    fontSize: 11, fontWeight: 700
                  }}>Export CSV</div>
                )}
              </div>

              <div style={{
                position: 'absolute', top: 218, left: 24, right: 24, bottom: 16,
                background: C.surface,
                border: `1px solid rgba(124,58,237,0.2)`,
                borderRadius: 12, overflow: 'hidden'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 155px 70px',
                  padding: '8px 14px',
                  background: '#0A0A10',
                  borderBottom: `1px solid ${C.border}`
                }}>
                  {['BUSINESS NAME', 'PHONE', 'EMAIL', 'RATING'].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                  ))}
                </div>

                {RESULTS.slice(0, rowsToShow).map((r, i) => {
                  const rowOpacity = Math.min(1, Math.max(0, (localS2 - (resultsStart + i * 20)) / 10))
                  return (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 130px 155px 70px',
                      padding: '10px 14px',
                      borderBottom: `1px solid rgba(255,255,255,0.04)`,
                      background: i % 2 === 0 ? C.surface : '#0D0D12',
                      opacity: rowOpacity
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>{r.phone}</div>
                      <div style={{ fontSize: 10, color: C.lavender }}>{r.email}</div>
                      <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>★ {r.rating}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </AbsoluteFill>
      )}

      {/* SEGMENT 3 — Results scroll */}
      {isSegment3 && (
        <AbsoluteFill>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${C.border}`,
            background: 'rgba(5,5,8,0.98)', zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>LT</div>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Lead<span style={{ color: C.lavender }}>Thur</span></span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 8, padding: '4px 10px'
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
              <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>847 Law Firms — Dubai, UAE</span>
            </div>
          </div>

          <div style={{
            position: 'absolute', top: 58, left: 24, right: 24, bottom: 16,
            background: C.surface,
            border: `1px solid rgba(124,58,237,0.2)`,
            borderRadius: 12, overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 155px 70px',
              padding: '8px 14px',
              background: '#0A0A10',
              borderBottom: `1px solid ${C.border}`,
              position: 'sticky', top: 0
            }}>
              {['BUSINESS NAME', 'PHONE', 'EMAIL', 'RATING'].map(h => (
                <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
              ))}
            </div>

            <div style={{ transform: `translateY(-${scrollY}px)` }}>
              {[...RESULTS, ...RESULTS, ...RESULTS].map((r, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 155px 70px',
                  padding: '11px 14px',
                  borderBottom: `1px solid rgba(255,255,255,0.04)`,
                  background: i % 2 === 0 ? C.surface : '#0D0D12'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>{r.phone}</div>
                  <div style={{ fontSize: 10, color: C.lavender }}>{r.email}</div>
                  <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>★ {r.rating}</div>
                </div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* SEGMENT 4 — Export */}
      {isSegment4 && (
        <AbsoluteFill>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '14px 24px',
            display: 'flex', alignItems: 'center',
            borderBottom: `1px solid ${C.border}`,
            background: 'rgba(5,5,8,0.98)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>LT</div>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Lead<span style={{ color: C.lavender }}>Thur</span></span>
            </div>
          </div>

          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 32, width: 440,
            boxShadow: '0 40px 80px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 5 }}>Exporting your contacts</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>leadthur-law-firms-dubai-uae.csv</div>

            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 7, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ width: `${downloadProgress}%`, height: '100%', background: C.green, borderRadius: 100, boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
            </div>

            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              {downloadProgress < 100 ? `Exporting ${Math.floor(downloadProgress * 8.47)} of 847 contacts...` : '847 contacts exported'}
            </div>

            {localS4 > 82 && (
              <div style={{
                opacity: successOpacity,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8, padding: '9px 12px',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>File saved to Downloads</span>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* SEGMENT 5 — CTA */}
      {isSegment5 && (
        <AbsoluteFill style={{
          opacity: ctaOpacity,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 60px'
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700, height: 700,
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 65%)',
            pointerEvents: 'none'
          }} />

          <div style={{ opacity: btn1Opacity, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, background: C.purple, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white' }}>LT</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.white }}>Lead<span style={{ color: C.lavender }}>Thur</span></span>
          </div>

          <div style={{ opacity: btn1Opacity, fontSize: 50, fontWeight: 900, letterSpacing: -2, color: C.white, lineHeight: 1.05, marginBottom: 10 }}>
            Stop searching.
          </div>
          <div style={{ opacity: btn2Opacity, fontSize: 50, fontWeight: 900, letterSpacing: -2, color: C.lavender, lineHeight: 1.05, marginBottom: 20 }}>
            Start closing.
          </div>

          <div style={{ opacity: priceOpacity, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div style={{ fontSize: 14, color: '#555570', textDecoration: 'line-through' }}>Apollo: $588/yr</div>
            <div style={{ fontSize: 14, color: C.muted }}>vs</div>
            <div style={{ fontSize: 17, color: C.white, fontWeight: 800 }}>LeadThur: <span style={{ color: C.green }}>$25 once</span></div>
          </div>

          <div style={{
            opacity: ctaBtnOpacity,
            background: C.purple, color: 'white',
            padding: '16px 44px', borderRadius: 14,
            fontSize: 17, fontWeight: 800,
            boxShadow: '0 0 60px rgba(124,58,237,0.55)',
            transform: `scale(${btnPulse})`,
            marginBottom: 14
          }}>
            Get Lifetime Access — $25
          </div>

          <div style={{ opacity: urlOpacity, fontSize: 13, color: C.muted }}>
            leadthur.com · Try free before you pay
          </div>
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  )
}
