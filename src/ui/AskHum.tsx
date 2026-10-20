import { useState } from 'react'
import { Loader2, Square, Volume2, VolumeX } from 'lucide-react'

const CONCIERGE_URL = 'https://dqlroiegulftcqserpfi.supabase.co/functions/v1/concierge'

function speechOk(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function speak(text: string, onEnd: () => void) {
  if (!speechOk()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.onend = onEnd
  u.onerror = onEnd
  synth.speak(u)
}

export default function AskHum({ onPlaces }: { onPlaces: (ids: string[]) => void }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [voice, setVoice] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const canSpeak = speechOk()

  const stop = () => {
    if (speechOk()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const submit = async () => {
    const q = question.trim()
    if (!q || busy) return
    setBusy(true)
    setError('')
    stop()
    try {
      const r = await fetch(CONCIERGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Austin, TX', question: q }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const data = (await r.json()) as { answer?: string; place_ids?: string[] }
      const text = data.answer?.trim() || 'Hum didn’t have an answer for that.'
      setAnswer(text)
      onPlaces(Array.isArray(data.place_ids) ? data.place_ids : [])
      if (voice && canSpeak) {
        setSpeaking(true)
        speak(text, () => setSpeaking(false))
      }
    } catch {
      setError('Couldn’t reach Hum just now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex-none px-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label htmlFor="ask-hum" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
        Ask Hum
      </label>
      <div className="flex gap-1.5">
        <input
          id="ask-hum"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What's good tonight near Rainey?"
          className="h-10 min-w-0 flex-1 rounded-xl bg-zinc-900/[0.045] px-3 text-[14px] text-zinc-900 outline-none ring-1 ring-transparent placeholder:text-zinc-400 focus:bg-white focus:ring-zinc-900/15"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="h-10 flex-none rounded-xl bg-zinc-900 px-3 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : 'Ask'}
        </button>
      </div>
      {(answer || error) && (
        <div className="mt-2 rounded-xl bg-zinc-900/[0.04] px-3 py-2">
          <p className="text-[13px] leading-5 text-zinc-700">{error || answer}</p>
          {answer && canSpeak && (
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                aria-pressed={voice}
                onClick={() => {
                  const next = !voice
                  setVoice(next)
                  if (!next) stop()
                }}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2 text-[12px] font-medium text-zinc-600 ring-1 ring-black/10"
              >
                {voice ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {voice ? 'Speaker on' : 'Speaker off'}
              </button>
              <button
                type="button"
                onClick={stop}
                disabled={!speaking}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2 text-[12px] font-medium text-zinc-600 ring-1 ring-black/10 disabled:opacity-40"
              >
                <Square size={11} />
                Stop
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
