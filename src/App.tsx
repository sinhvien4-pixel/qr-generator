import { useState, useRef, useCallback, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { HexColorPicker } from 'react-colorful'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './lib/firebase'
import type { QRType, WiFiConfig } from './types'
import { validateContent } from './utils/contentFilter'

const QR_SIZES = [150, 200, 300, 400, 500] as const
const TABS: { id: QRType; label: string; icon: string }[] = [
  { id: 'url', label: 'URL', icon: '🔗' },
  { id: 'text', label: 'Text', icon: '📝' },
  { id: 'email', label: 'Email', icon: '✉️' },
  { id: 'phone', label: 'Phone', icon: '📞' },
  { id: 'wifi', label: 'WiFi', icon: '📶' },
]

function buildQRValue(type: QRType, inputs: Record<string, string>, wifi: WiFiConfig): string {
  switch (type) {
    case 'url': return inputs.url || ''
    case 'text': return inputs.text || ''
    case 'email': {
      const parts = [`mailto:${inputs.email || ''}`]
      if (inputs.subject) parts.push(`subject=${encodeURIComponent(inputs.subject)}`)
      if (inputs.body) parts.push(`body=${encodeURIComponent(inputs.body)}`)
      return parts.length > 1 ? `${parts[0]}?${parts.slice(1).join('&')}` : parts[0]
    }
    case 'phone': return `tel:${inputs.phone || ''}`
    case 'wifi':
      return `WIFI:T:${wifi.encryption};S:${wifi.ssid};P:${wifi.password};H:${wifi.hidden};;`
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<QRType>('url')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [wifi, setWifi] = useState<WiFiConfig>({ ssid: '', password: '', encryption: 'WPA', hidden: false })
  const [fgColor, setFgColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [size, setSize] = useState(300)
  const [logo, setLogo] = useState<string | null>(null)
  const [showFgPicker, setShowFgPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [isBlocked, setIsBlocked] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const wasBlockedRef = useRef(false)

  const qrValue = buildQRValue(activeTab, inputs, wifi)

  useEffect(() => {
    const blocked = qrValue ? !validateContent(qrValue) : false
    if (blocked && !wasBlockedRef.current) {
      alert('Content blocked due to NSFW policy.')
    }
    wasBlockedRef.current = blocked
    setIsBlocked(blocked)
  }, [qrValue])

  const setInput = (key: string, val: string) =>
    setInputs(prev => ({ ...prev, [key]: val }))

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const getCanvas = (): HTMLCanvasElement | null =>
    canvasRef.current?.querySelector('canvas') ?? null

  const handleDownload = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${activeTab}-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleCopy = useCallback(async () => {
    const canvas = getCanvas()
    if (!canvas) return
    canvas.toBlob(async blob => {
      if (!blob) return
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        setCopied(false)
      }
    })
  }, [])

  const handleSave = async () => {
    if (!qrValue) return
    if (!validateContent(qrValue)) {
      alert('Content blocked due to NSFW policy.')
      return
    }
    setSaving(true)
    setSaveMsg('')
    try {
      await addDoc(collection(db, 'qr_codes'), {
        type: activeTab,
        value: qrValue,
        fgColor,
        bgColor,
        size,
        createdAt: serverTimestamp(),
      })
      setSaveMsg('Saved to history!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Firestore save error:', msg)
      setSaveMsg(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 6000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">QR Code Generator</h1>
          <p className="text-slate-400">Generate beautiful QR codes with custom colors and logos</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left panel */}
          <div className="space-y-6">
            {/* Type tabs */}
            <div className="bg-slate-800/60 rounded-2xl p-1 flex gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setInputs({}) }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Input fields */}
            <div className="bg-slate-800/60 rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-slate-200">Content</h2>
              <InputFields type={activeTab} inputs={inputs} setInput={setInput} wifi={wifi} setWifi={setWifi} />
            </div>

            {/* Size */}
            <div className="bg-slate-800/60 rounded-2xl p-5">
              <h2 className="font-semibold text-slate-200 mb-3">Size</h2>
              <div className="flex gap-2 flex-wrap">
                {QR_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      size === s
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="bg-slate-800/60 rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-slate-200">Colors</h2>
              <div className="grid grid-cols-2 gap-4">
                <ColorField label="QR Color" color={fgColor} setColor={setFgColor} show={showFgPicker} toggle={() => { setShowFgPicker(p => !p); setShowBgPicker(false) }} />
                <ColorField label="Background" color={bgColor} setColor={setBgColor} show={showBgPicker} toggle={() => { setShowBgPicker(p => !p); setShowFgPicker(false) }} />
              </div>
            </div>

            {/* Logo */}
            <div className="bg-slate-800/60 rounded-2xl p-5">
              <h2 className="font-semibold text-slate-200 mb-3">Center Logo</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-all"
                >
                  {logo ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logo && (
                  <button onClick={() => setLogo(null)} className="px-4 py-2 bg-red-900/50 hover:bg-red-800/60 text-red-300 rounded-lg text-sm transition-all">
                    Remove
                  </button>
                )}
                {logo && <img src={logo} alt="logo preview" className="h-10 w-10 object-contain rounded" />}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </div>
          </div>

          {/* Right panel — preview */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-800/60 rounded-2xl p-6 flex flex-col items-center gap-6 sticky top-6">
              <h2 className="font-semibold text-slate-200 self-start">Preview</h2>

              {isBlocked ? (
                <div
                  className="flex items-center justify-center rounded-xl bg-red-900/30 border border-red-700/50 text-red-400 text-sm font-medium"
                  style={{ width: size, height: size, maxWidth: '100%' }}
                >
                  Content blocked due to NSFW policy.
                </div>
              ) : qrValue ? (
                <div ref={canvasRef} className="rounded-xl overflow-hidden shadow-2xl">
                  <QRCodeCanvas
                    value={qrValue}
                    size={size}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level="H"
                    {...(logo
                      ? {
                          imageSettings: {
                            src: logo,
                            height: Math.round(size * 0.2),
                            width: Math.round(size * 0.2),
                            excavate: true,
                          },
                        }
                      : {})}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center rounded-xl bg-slate-700/40 text-slate-500 text-sm"
                  style={{ width: size, height: size, maxWidth: '100%' }}
                >
                  Enter content to generate QR
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 w-full justify-center">
                <button
                  onClick={handleDownload}
                  disabled={!qrValue || isBlocked}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-all"
                >
                  ⬇️ Download PNG
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!qrValue || isBlocked}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-all"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Image'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!qrValue || saving || isBlocked}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-all"
                >
                  {saving ? '⏳ Saving…' : '💾 Save'}
                </button>
              </div>

              {saveMsg && (
                <p className={`text-sm ${saveMsg.includes('failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {saveMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function InputFields({
  type, inputs, setInput, wifi, setWifi,
}: {
  type: QRType
  inputs: Record<string, string>
  setInput: (k: string, v: string) => void
  wifi: WiFiConfig
  setWifi: React.Dispatch<React.SetStateAction<WiFiConfig>>
}) {
  const cls = "w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"

  if (type === 'url') return (
    <input className={cls} placeholder="https://example.com" value={inputs.url ?? ''} onChange={e => setInput('url', e.target.value)} />
  )
  if (type === 'text') return (
    <textarea className={`${cls} resize-none`} rows={4} placeholder="Enter your text…" value={inputs.text ?? ''} onChange={e => setInput('text', e.target.value)} />
  )
  if (type === 'email') return (
    <div className="space-y-3">
      <input className={cls} type="email" placeholder="Email address" value={inputs.email ?? ''} onChange={e => setInput('email', e.target.value)} />
      <input className={cls} placeholder="Subject (optional)" value={inputs.subject ?? ''} onChange={e => setInput('subject', e.target.value)} />
      <textarea className={`${cls} resize-none`} rows={3} placeholder="Body (optional)" value={inputs.body ?? ''} onChange={e => setInput('body', e.target.value)} />
    </div>
  )
  if (type === 'phone') return (
    <input className={cls} type="tel" placeholder="+1 234 567 8900" value={inputs.phone ?? ''} onChange={e => setInput('phone', e.target.value)} />
  )
  // wifi
  return (
    <div className="space-y-3">
      <input className={cls} placeholder="Network name (SSID)" value={wifi.ssid} onChange={e => setWifi(w => ({ ...w, ssid: e.target.value }))} />
      <input className={cls} type="password" placeholder="Password" value={wifi.password} onChange={e => setWifi(w => ({ ...w, password: e.target.value }))} />
      <select className={cls} value={wifi.encryption} onChange={e => setWifi(w => ({ ...w, encryption: e.target.value as WiFiConfig['encryption'] }))}>
        <option value="WPA">WPA/WPA2</option>
        <option value="WEP">WEP</option>
        <option value="nopass">No Password</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input type="checkbox" checked={wifi.hidden} onChange={e => setWifi(w => ({ ...w, hidden: e.target.checked }))} className="accent-purple-500" />
        Hidden network
      </label>
    </div>
  )
}

function ColorField({
  label, color, setColor, show, toggle,
}: {
  label: string
  color: string
  setColor: (c: string) => void
  show: boolean
  toggle: () => void
}) {
  return (
    <div className="relative">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl px-3 py-2 transition-all"
      >
        <span className="w-6 h-6 rounded-md border border-slate-500 flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-mono text-slate-200">{color.toUpperCase()}</span>
      </button>
      {show && (
        <div className="absolute z-20 mt-2 left-0 bg-slate-800 border border-slate-600 rounded-2xl p-3 shadow-2xl">
          <HexColorPicker color={color} onChange={setColor} />
          <input
            type="text"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
          />
        </div>
      )}
    </div>
  )
}
