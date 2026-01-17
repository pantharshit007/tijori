import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  KeyRound,
  Lock,
  Unlock,
  Hash as HashIcon,
  Info,
  AlertCircle,
} from 'lucide-react'

function arrayBufferToHex(b: ArrayBuffer) {
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}
function base64Encode(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function base64Decode(s: string): ArrayBuffer {
  const bin = atob(s)
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0))).buffer
}

function CryptoTest() {
  const [passcode, setPasscode] = useState('')
  const [salt, setSalt] = useState('')
  const [text, setText] = useState('')
  const [derivedKeyHex, setDerivedKeyHex] = useState('')
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null)
  const [encrypted, setEncrypted] = useState('')
  const [iv, setIv] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [hashHex, setHashHex] = useState('')
  const [operation, setOperation] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Derive Key using PBKDF2
  async function deriveKey() {
    setOperation('Deriving key...')
    setError(null)
    try {
      const enc = new TextEncoder()
      const raw = enc.encode(passcode)
      const saltBytes = enc.encode(salt)
      const imp = await window.crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'PBKDF2' },
        false,
        ['deriveKey'],
      )
      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 100000,
          hash: 'SHA-256',
        },
        imp,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      )
      setDerivedKey(key)
      // Export for display
      const exported = await window.crypto.subtle.exportKey('raw', key)
      setDerivedKeyHex(arrayBufferToHex(exported))
      setOperation('Key derived')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  // Encrypt using AES-GCM
  async function encrypt() {
    setOperation('Encrypting...')
    setError(null)
    try {
      if (!derivedKey) throw new Error('Key not derived yet!')
      const enc = new TextEncoder()
      const ivRaw = window.crypto.getRandomValues(new Uint8Array(12))
      setIv(base64Encode(ivRaw.buffer))
      const ct = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: ivRaw },
        derivedKey,
        enc.encode(text),
      )
      setEncrypted(base64Encode(ct))
      setOperation('Encrypted')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  // Decrypt using AES-GCM
  async function decrypt() {
    setOperation('Decrypting...')
    setError(null)
    try {
      if (!derivedKey) throw new Error('Key not derived yet!')
      const dec = new TextDecoder()
      const ivRaw = new Uint8Array(base64Decode(iv))
      const ctRaw = base64Decode(encrypted)
      const pt = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivRaw },
        derivedKey,
        ctRaw,
      )
      setDecrypted(dec.decode(pt))
      setOperation('Decrypted')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  // Hash using SHA-256
  async function doHash() {
    setOperation('Hashing...')
    setError(null)
    try {
      const enc = new TextEncoder()
      const hash = await window.crypto.subtle.digest(
        'SHA-256',
        enc.encode(passcode),
      )
      setHashHex(arrayBufferToHex(hash))
      setOperation('Hashed')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  return (
    <div className="max-w-xl mx-auto my-12 p-6 border border-slate-800 bg-slate-900/80 rounded-xl shadow-2xl text-slate-200">
      <div className="mb-8 bg-sky-950/80 p-4 rounded-lg flex items-start gap-3">
        <Info
          className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1"
          aria-hidden
        />
        <div>
          <h2 className="text-xl font-bold mb-1">Crypto Test UI</h2>
          <ul className="text-xs text-slate-300 list-disc pl-5">
            <li>
              Fill passcode and salt, click <b>Derive Key</b>{' '}
              <KeyRound className="inline ml-1 w-4 h-4" aria-label="key icon" />{' '}
              to generate a key
            </li>
            <li>
              Enter text and click <b>Encrypt</b>{' '}
              <Lock className="inline ml-1 w-4 h-4" aria-label="lock icon" /> to
              encipher
            </li>
            <li>
              Test decryption by clicking <b>Decrypt</b>{' '}
              <Unlock
                className="inline ml-1 w-4 h-4"
                aria-label="unlock icon"
              />
              ; alter inputs to verify failures
            </li>
            <li>
              Compute a SHA-256 hash of passcode or text with <b>Hash</b>{' '}
              <HashIcon
                className="inline ml-1 w-4 h-4"
                aria-label="hash icon"
              />
            </li>
          </ul>
        </div>
      </div>
      {/* Derive Key Section */}
      <section className="mb-8 p-4 rounded-lg bg-slate-800/70 shadow-md">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-cyan-400">
          <KeyRound className="w-5 h-5" aria-hidden />
          Derive Key (PBKDF2)
        </h3>
        <div className="flex flex-col gap-2">
          <label className="text-xs opacity-80">
            Passcode
            <input
              aria-label="Passcode"
              className="block w-2/3 mt-1 px-2 py-2 rounded-md bg-slate-900 border border-slate-600 focus:border-cyan-500 focus:ring focus:ring-cyan-700/20 outline-none text-base"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="text-xs opacity-80">
            Salt
            <input
              aria-label="Salt"
              className="block w-2/3 mt-1 px-2 py-2 rounded-md bg-slate-900 border border-slate-600 focus:border-cyan-500 focus:ring focus:ring-cyan-700/20 outline-none"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              placeholder="Random string"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            aria-label="Derive Key"
            onClick={deriveKey}
            className="mt-4 w-max flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300 transition text-white shadow-md text-base"
          >
            <KeyRound className="w-5 h-5" aria-hidden />
            Derive Key
          </button>
          {derivedKeyHex && (
            <div className="text-xs font-mono mt-1 break-all text-cyan-300 select-all">
              Key: {derivedKeyHex}
            </div>
          )}
        </div>
      </section>
      {/* Encrypt Section */}
      <section className="mb-8 p-4 rounded-lg bg-slate-800/70 shadow-md">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-400">
          <Lock className="w-5 h-5" aria-hidden />
          Encrypt (AES-GCM)
        </h3>
        <label className="text-xs opacity-80 mb-2">
          Text to Encrypt
          <input
            aria-label="Text to Encrypt"
            className="block w-5/6 mt-1 px-2 py-2 rounded-md bg-slate-900 border border-slate-600 focus:border-green-500 focus:ring focus:ring-green-700/20 outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="flex items-center gap-4 mt-2">
          <button
            type="button"
            aria-label="Encrypt"
            disabled={!derivedKey}
            onClick={encrypt}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:bg-green-900/60 disabled:cursor-not-allowed transition text-white shadow-md text-base"
          >
            <Lock className="w-5 h-5" aria-hidden />
            Encrypt
          </button>
          {encrypted && (
            <button
              className="ml-2 px-2 py-1 rounded bg-slate-600 text-xs text-white hover:bg-slate-700"
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(encrypted)
              }}
              aria-label="Copy encrypted result to clipboard"
            >
              <span>Copy Encrypted</span>
            </button>
          )}
        </div>
        {encrypted && (
          <>
            <div className="text-xs font-mono mt-2 break-all text-green-300 select-all">
              Encrypted: {encrypted}
            </div>
            <div className="text-xs font-mono mt-1 select-all">IV: {iv}</div>
          </>
        )}
      </section>
      {/* Decrypt Section */}
      <section className="mb-8 p-4 rounded-lg bg-slate-800/70 shadow-md">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-yellow-300">
          <Unlock className="w-5 h-5" aria-hidden />
          Decrypt (AES-GCM)
        </h3>
        <div className="flex flex-col gap-2">
          <input
            aria-label="Encrypted Data (base64)"
            placeholder="Encrypted Data (base64)"
            className="block w-5/6 px-2 py-2 rounded-md bg-slate-900 border border-slate-600 focus:border-yellow-400 focus:ring focus:ring-yellow-400/20 outline-none"
            value={encrypted}
            onChange={(e) => setEncrypted(e.target.value)}
            autoComplete="off"
          />
          <input
            aria-label="IV (base64)"
            placeholder="IV (base64)"
            className="block w-3/5 mt-1 px-2 py-2 rounded-md bg-slate-900 border border-slate-600 focus:border-yellow-400 focus:ring focus:ring-yellow-400/20 outline-none"
            value={iv}
            onChange={(e) => setIv(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            aria-label="Decrypt"
            disabled={!derivedKey || !encrypted || !iv}
            onClick={decrypt}
            className="w-max flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200/80 disabled:bg-yellow-950/60 disabled:cursor-not-allowed transition text-black shadow-md text-base mt-1"
          >
            <Unlock className="w-5 h-5" aria-hidden />
            Decrypt
          </button>
        </div>
        {decrypted && (
          <div className="text-xs font-mono mt-2 break-all text-yellow-400 select-all">
            Plain: {decrypted}
          </div>
        )}
      </section>
      {/* Hash Section */}
      <section className="mb-8 p-4 rounded-lg bg-slate-800/70 shadow-md">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-fuchsia-400">
          <HashIcon className="w-5 h-5" aria-hidden />
          Hash (SHA-256)
        </h3>
        <button
          type="button"
          aria-label="Hash Passcode / Text"
          onClick={doHash}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold bg-fuchsia-700 hover:bg-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 transition text-white shadow-md text-base"
        >
          <HashIcon className="w-5 h-5" aria-hidden />
          Hash Passcode / Text (SHA-256)
        </button>
        {hashHex && (
          <div className="text-xs font-mono mt-2 break-all text-fuchsia-300 select-all">
            Hash: {hashHex}
          </div>
        )}
      </section>
      {/* Feedback Section */}
      <div aria-live="polite">
        {operation && (
          <div className="mt-4 flex items-center gap-2 text-cyan-300">
            <Info className="w-4 h-4" aria-hidden />
            <span>{operation}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-rose-400">
            <AlertCircle className="w-4 h-4" aria-hidden />
            <span>Error: {error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/crypto-test')({ component: CryptoTest })
