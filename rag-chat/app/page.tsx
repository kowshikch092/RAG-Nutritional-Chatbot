'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Citation { page: string; text: string; highlight: string }
interface ApiChunk {
  content?: string
  metadata?: { page?: string | number }
}
interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
  citations?: Citation[]
  time: string
}

function now() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }
  const playTick = useCallback(() => {
    const c = getCtx()
    const o = c.createOscillator(); const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sine'; o.frequency.setValueAtTime(660, c.currentTime)
    g.gain.setValueAtTime(0.03, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.07)
    o.start(); o.stop(c.currentTime + 0.07)
  }, [])
  const playDone = useCallback(() => {
    const c = getCtx()
    ;[523, 659, 784].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.type = 'sine'; o.frequency.setValueAtTime(freq, c.currentTime)
      const t = c.currentTime + i * 0.08
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.04, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      o.start(t); o.stop(t + 0.2)
    })
  }, [])
  return { playTick, playDone }
}

// Update CitationPopup component styles
function CitationPopup({ citation, index, onClose }: {
  citation: Citation; index: number; onClose: () => void
}) {
  const popupRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Auto-position to prevent clipping
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect()
      const parentRect = popupRef.current.parentElement?.getBoundingClientRect()
      
      if (parentRect && rect.top < 0) {
        // If popup would go above viewport, position it below instead
        popupRef.current.style.top = '120%'
        popupRef.current.style.bottom = 'auto'
      }
    }
  }, [])

  return (
    <div 
      ref={popupRef}
      style={{
        position: 'absolute', 
        bottom: '110%', 
        left: 0, 
        zIndex: 1000, // Increased z-index to ensure visibility
        width: 320, 
        background: '#0c1018',
        border: '0.5px solid rgba(99,132,255,0.35)',
        borderRadius: 12, 
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(99,132,255,0.08)',
      }}
    >
      {/* ... rest of the component remains the same ... */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#101520',
        borderBottom: '0.5px solid rgba(99,132,255,0.15)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#6384ff', fontFamily: 'Space Mono, monospace' }}>
          Source #{index + 1}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a5270' }}>
          Page {citation.page}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#4a5270',
          fontSize: 14, cursor: 'pointer', padding: '0 2px',
        }}>✕</button>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <p style={{ fontSize: 12, color: '#8892b0', lineHeight: 1.5, marginBottom: 8 }}>
          {citation.text}
        </p>
        <div style={{
          background: 'rgba(99,132,255,0.08)',
          borderLeft: '2px solid #6384ff',
          padding: '7px 10px', borderRadius: '0 6px 6px 0',
          fontSize: 12, fontStyle: 'italic',
          color: '#c8d0ff', lineHeight: 1.55,
        }}>
          {citation.highlight}
        </div>
      </div>
    </div>
  )
}

function CitationBtn({ c, i }: { c: Citation; i: number }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px',
          background: open ? 'rgba(99,132,255,0.15)' : 'rgba(99,132,255,0.07)',
          border: `0.5px solid ${open ? 'rgba(99,132,255,0.45)' : 'rgba(99,132,255,0.2)'}`,
          borderRadius: 20,
          fontFamily: 'Space Mono, monospace', fontSize: 11,
          color: open ? '#a0b0ff' : '#6384ff',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          background: 'rgba(99,132,255,0.2)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 700, color: '#8fa0ff',
        }}>{i + 1}</span>
        p.{c.page}
      </button>
      {open && <CitationPopup citation={c} index={i} onClose={() => setOpen(false)} />}
    </span>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '10px 0 4px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#6384ff', opacity: 0.3,
          animation: `dotBounce 1.2s ${i * 0.2}s infinite`,
          display: 'block',
        }} />
      ))}
    </div>
  )
}

function normalizeCitations(items: unknown): Citation[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      const chunk = item as ApiChunk & {
        text?: string
        highlight?: string
        page?: string | number
      }

      const page = chunk.metadata?.page ?? chunk.page ?? '?'
      const text = chunk.text ?? chunk.content ?? ''
      const highlight = chunk.highlight ?? chunk.content ?? text

      if (!text && !highlight) return null

      return {
        page: String(page),
        text,
        highlight,
      }
    })
    .filter((citation): citation is Citation => citation !== null)
}

function MsgRow({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const parts = msg.content.split(/\*\*(.+?)\*\*/g)
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '0.5px solid rgba(99,132,255,0.08)',
      animation: 'fadeSlide 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
          fontFamily: 'Space Mono, monospace',
          background: isUser ? 'rgba(99,132,255,0.1)' : 'rgba(0,212,170,0.12)',
          color: isUser ? '#6384ff' : '#00d4aa',
          border: `0.5px solid ${isUser ? 'rgba(99,132,255,0.25)' : 'rgba(0,212,170,0.25)'}`,
        }}>
          {isUser ? 'YOU' : 'AI'}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
          textTransform: 'uppercase', fontFamily: 'Space Mono, monospace',
          color: isUser ? '#6384ff' : '#00d4aa',
        }}>
          {isUser ? 'You' : 'RAG Nutritional Chatbot'}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10,
          fontFamily: 'Space Mono, monospace', color: '#2e3550',
        }}>
          {msg.time}
        </span>
      </div>
      <div style={{
        paddingLeft: 30, fontSize: 14.5, lineHeight: 1.75,
        color: '#c8d2f0',
      }}>
        {parts.map((p, i) =>
          i % 2 === 1
            ? <strong key={i} style={{ color: '#a0b4ff', fontWeight: 600 }}>{p}</strong>
            : <span key={i}>{p}</span>
        )}
      </div>
      {msg.citations && msg.citations.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 30, marginTop: 10 }}>
        {msg.citations.map((c, i) => (
          <CitationBtn key={`${msg.id}-citation-${i}`} c={c} i={i} />
        ))}
      </div>
    )}
    </div>
  )
}

const CHIPS = [
  'What are macronutrients?',
  'Benefits of Vitamin D',
  'How much protein per day?',
  'What is BMI?',
  'Explain dietary fiber',
]

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { playTick, playDone } = useAudio()

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const startTicks = () => { playTick(); tickRef.current = setInterval(playTick, 600) }
  const stopTicks  = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null } }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(m => [...m, { id: Date.now().toString(), role: 'user', content: text, time: now() }])
    setLoading(true)
    startTicks()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      const citations = normalizeCitations(data.citations ?? data.sources)
      stopTicks(); playDone()
      setMessages(m => [...m, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: data.answer || data.response || data.message || 'No response.',
        citations,
        time: now(),
      }])
    } catch (err) {
      stopTicks()
      setMessages(m => [...m, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: `Server not reachable. Make sure your Node.js backend is running.\n\`${err}\``,
        time: now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const showWelcome = messages.length === 0 && !loading

  return (
    <>
      <style>{`
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBounce { 0%,60%,100%{opacity:.2;transform:translateY(0)} 30%{opacity:1;transform:translateY(-4px)} }
        @keyframes pulseGreen { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes scanline {
          0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)}
        }
        textarea { resize: none; }
        textarea::placeholder { color: #2e3a54; }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        maxWidth: 820, margin: '0 auto', position: 'relative',
        background: '#060910',
      }}>

        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(99,132,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,132,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />

        {/* Corner accents */}
        <div style={{ position:'absolute', top:0, left:0, width:60, height:60, pointerEvents:'none', zIndex:1,
          borderTop:'1px solid rgba(99,132,255,0.4)', borderLeft:'1px solid rgba(99,132,255,0.4)', borderRadius:'0 0 4px 0' }} />
        <div style={{ position:'absolute', top:0, right:0, width:60, height:60, pointerEvents:'none', zIndex:1,
          borderTop:'1px solid rgba(99,132,255,0.4)', borderRight:'1px solid rgba(99,132,255,0.4)', borderRadius:'0 0 0 4px' }} />
        <div style={{ position:'absolute', bottom:0, left:0, width:60, height:60, pointerEvents:'none', zIndex:1,
          borderBottom:'1px solid rgba(99,132,255,0.4)', borderLeft:'1px solid rgba(99,132,255,0.4)', borderRadius:'0 4px 0 0' }} />
        <div style={{ position:'absolute', bottom:0, right:0, width:60, height:60, pointerEvents:'none', zIndex:1,
          borderBottom:'1px solid rgba(99,132,255,0.4)', borderRight:'1px solid rgba(99,132,255,0.4)', borderRadius:'4px 0 0 0' }} />

        {/* HEADER */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '0.5px solid rgba(99,132,255,0.15)',
          background: 'rgba(6,9,16,0.95)', position: 'relative', zIndex: 5,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#6384ff',
                boxShadow: '0 0 8px rgba(99,132,255,0.8)',
              }} />
              <span style={{
                fontFamily: 'Space Mono, monospace', fontSize: 13,
                fontWeight: 700, letterSpacing: '0.04em', color: '#e0e8ff',
              }}>
                RAG Nutritional Chatbot
              </span>
            </div>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: 9,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#2e3a54', paddingLeft: 18,
            }}>
              Build from Scratch · Presented by KOWSHIK
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            background: 'rgba(0,212,170,0.06)',
            border: '0.5px solid rgba(0,212,170,0.2)',
            borderRadius: 20,
            fontFamily: 'Space Mono, monospace', fontSize: 10,
            color: '#00d4aa',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#00d4aa',
              boxShadow: '0 0 6px rgba(0,212,170,0.7)',
              animation: 'pulseGreen 2s infinite',
              display: 'block',
            }} />
            Online
          </div>
        </header>

        {/* MESSAGES */}
        <div ref={msgsRef} style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          display: 'flex', flexDirection: 'column',
          position: 'relative', zIndex: 2,
        }}>
          {showWelcome ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', gap: 20, padding: '40px 20px',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                border: '0.5px solid rgba(99,132,255,0.3)',
                background: 'rgba(99,132,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>🥗</div>
              <div>
                <h1 style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 22, fontWeight: 600, color: '#e0e8ff',
                  letterSpacing: '-0.01em', marginBottom: 8,
                }}>
                  RAG Nutritional Chatbot
                </h1>
                <p style={{ fontSize: 13.5, color: '#4a5270', maxWidth: 360, lineHeight: 1.65 }}>
                  Ask anything about human nutrition — vitamins, macros, dietary guidelines, and more.
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                {CHIPS.map(c => (
                  <button key={c} onClick={() => send(c)} style={{
                    padding: '7px 14px',
                    background: 'rgba(99,132,255,0.06)',
                    border: '0.5px solid rgba(99,132,255,0.2)',
                    borderRadius: 20, cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 12.5,
                    color: '#6384ff', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.background = 'rgba(99,132,255,0.14)'
                    ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(99,132,255,0.4)'
                    ;(e.target as HTMLButtonElement).style.color = '#a0b4ff'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.background = 'rgba(99,132,255,0.06)'
                    ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(99,132,255,0.2)'
                    ;(e.target as HTMLButtonElement).style.color = '#6384ff'
                  }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(m => <MsgRow key={m.id} msg={m} />)}
              {loading && (
                <div style={{ padding: '18px 0', borderBottom: '0.5px solid rgba(99,132,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(0,212,170,0.12)', border: '0.5px solid rgba(0,212,170,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#00d4aa',
                      fontFamily: 'Space Mono, monospace',
                    }}>AI</div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
                      textTransform: 'uppercase', fontFamily: 'Space Mono, monospace', color: '#00d4aa',
                    }}>RAG Nutritional Chatbot</span>
                  </div>
                  <div style={{ paddingLeft: 30 }}><TypingDots /></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* INPUT */}
        <div style={{
          padding: '14px 28px 20px',
          borderTop: '0.5px solid rgba(99,132,255,0.12)',
          background: 'rgba(6,9,16,0.97)', position: 'relative', zIndex: 5,
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: '#0c1018',
            border: '0.5px solid rgba(99,132,255,0.2)',
            borderRadius: 14, padding: '11px 14px',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,132,255,0.45)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(99,132,255,0.2)')}>
            <textarea
              rows={1}
              value={input}
              placeholder="Ask about nutrition…"
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
              }}
              onKeyDown={handleKey}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                color: '#c8d2f0', lineHeight: 1.5, minHeight: 22, maxHeight: 150,
                caretColor: '#6384ff', overflowY: 'auto',
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: loading || !input.trim() ? 'rgba(99,132,255,0.15)' : '#6384ff',
                color: loading || !input.trim() ? '#4a5270' : '#060910',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
          <p style={{
            textAlign: 'center', marginTop: 8,
            fontFamily: 'Space Mono, monospace', fontSize: 10,
            color: '#1e2535', letterSpacing: '0.04em',
          }}>
            Powered by{' '}
            <span style={{ color: '#2e3a54' }}>RAG</span> ·{' '}
            <span style={{ color: '#2e3a54' }}>Next.js</span> ·{' '}
            <span style={{ color: '#2e3a54' }}>Supabase</span>
          </p>
        </div>
      </div>
    </>
  )
}