import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  Hash as HashIcon,
  Info,
  KeyRound,
  Lock,
  Unlock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import {
  decrypt as cryptoDecrypt,
  deriveKey as cryptoDeriveKey,
  encrypt as cryptoEncrypt,
  hash as cryptoHash,
  generateSalt,
} from '@/lib/crypto'

function CryptoTest() {
  const [passcode, setPasscode] = useState('')
  const [salt, setSalt] = useState('')
  const [text, setText] = useState('')
  const [derivedKeyDisplay, setDerivedKeyDisplay] = useState('')
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null)
  const [encrypted, setEncrypted] = useState('')
  const [iv, setIv] = useState('')
  const [authTag, setAuthTag] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [hashResult, setHashResult] = useState('')
  const [operation, setOperation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function handleGenerateSalt() {
    const newSalt = generateSalt()
    setSalt(newSalt)
  }

  async function handleDeriveKey() {
    setOperation('Deriving key...')
    setError(null)
    try {
      if (!passcode || !salt) {
        throw new Error('Passcode and salt are required')
      }
      const key = await cryptoDeriveKey(passcode, salt)
      setDerivedKey(key)

      // Export for display (hex format)
      const exported = await crypto.subtle.exportKey('raw', key)
      const hex = Array.from(new Uint8Array(exported))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')
      setDerivedKeyDisplay(hex)
      setOperation('Key derived successfully!')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  async function handleEncrypt() {
    setOperation('Encrypting...')
    setError(null)
    try {
      if (!derivedKey) throw new Error('Derive a key first!')
      if (!text) throw new Error('Enter text to encrypt')

      const result = await cryptoEncrypt(text, derivedKey)
      setEncrypted(result.encryptedValue)
      setIv(result.iv)
      setAuthTag(result.authTag)
      setOperation('Encrypted successfully!')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  async function handleDecrypt() {
    setOperation('Decrypting...')
    setError(null)
    try {
      if (!derivedKey) throw new Error('Derive a key first!')
      if (!encrypted || !iv || !authTag)
        throw new Error('Encrypted data, IV, and AuthTag are required')

      const result = await cryptoDecrypt(encrypted, iv, authTag, derivedKey)
      setDecrypted(result)
      setOperation('Decrypted successfully!')
    } catch (e: any) {
      setError(e.message || 'Decryption failed - check your inputs')
      setOperation('')
    }
  }

  async function handleHash() {
    setOperation('Hashing...')
    setError(null)
    try {
      if (!passcode) throw new Error('Enter a passcode to hash')
      const result = await cryptoHash(passcode)
      setHashResult(result)
      setOperation('Hashed successfully!')
    } catch (e: any) {
      setError(e.message)
      setOperation('')
    }
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Crypto Test UI</h1>
        <p className="text-muted-foreground mt-2">
          Test the client-side encryption module using PBKDF2 key derivation and
          AES-256-GCM encryption.
        </p>
      </div>

      {/* Instructions */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            How to Use
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              Enter a passcode and generate a salt, then click{' '}
              <strong>Derive Key</strong>
            </li>
            <li>
              Enter text and click <strong>Encrypt</strong> to encrypt it
            </li>
            <li>
              Click <strong>Decrypt</strong> to verify decryption works
            </li>
            <li>
              Test <strong>Hash</strong> to compute SHA-256 of the passcode
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Derive Key Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-400">
            <KeyRound className="h-5 w-5" />
            Derive Key (PBKDF2)
          </CardTitle>
          <CardDescription>
            100,000 iterations with SHA-256 to derive AES-256 key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                type="password"
                placeholder="Enter your passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salt">Salt (Base64)</Label>
              <div className="flex gap-2">
                <Input
                  id="salt"
                  placeholder="Generate or enter salt"
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSalt}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
          <Button onClick={handleDeriveKey} className="gap-2">
            <KeyRound className="h-4 w-4" />
            Derive Key
          </Button>
          {derivedKeyDisplay && (
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Derived Key (Hex)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(derivedKeyDisplay, 'key')}
                >
                  {copied === 'key' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <code className="text-xs font-mono text-cyan-400 break-all">
                {derivedKeyDisplay}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Encrypt Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-400">
            <Lock className="h-5 w-5" />
            Encrypt (AES-256-GCM)
          </CardTitle>
          <CardDescription>Encrypt text with the derived key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plaintext">Text to Encrypt</Label>
            <Input
              id="plaintext"
              placeholder="Enter secret text..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <Button
            onClick={handleEncrypt}
            disabled={!derivedKey}
            className="gap-2"
            variant="secondary"
          >
            <Lock className="h-4 w-4" />
            Encrypt
          </Button>
          {encrypted && (
            <div className="space-y-3 mt-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Encrypted Value
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => copyToClipboard(encrypted, 'encrypted')}
                  >
                    {copied === 'encrypted' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <code className="text-xs font-mono text-green-400 break-all">
                  {encrypted}
                </code>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-muted">
                  <span className="text-xs font-medium text-muted-foreground block mb-1">
                    IV
                  </span>
                  <code className="text-xs font-mono break-all">{iv}</code>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <span className="text-xs font-medium text-muted-foreground block mb-1">
                    Auth Tag
                  </span>
                  <code className="text-xs font-mono break-all">{authTag}</code>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decrypt Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-400">
            <Unlock className="h-5 w-5" />
            Decrypt (AES-256-GCM)
          </CardTitle>
          <CardDescription>
            Decrypt using the encrypted value, IV, and auth tag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="encrypted">Encrypted Data (Base64)</Label>
            <Input
              id="encrypted"
              placeholder="Paste encrypted data..."
              value={encrypted}
              onChange={(e) => setEncrypted(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iv">IV (Base64)</Label>
              <Input
                id="iv"
                placeholder="IV..."
                value={iv}
                onChange={(e) => setIv(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authTag">Auth Tag (Base64)</Label>
              <Input
                id="authTag"
                placeholder="Auth tag..."
                value={authTag}
                onChange={(e) => setAuthTag(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleDecrypt}
            disabled={!derivedKey || !encrypted || !iv || !authTag}
            className="gap-2"
            variant="secondary"
          >
            <Unlock className="h-4 w-4" />
            Decrypt
          </Button>
          {decrypted && (
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Decrypted Text
              </span>
              <code className="text-sm font-mono text-yellow-400">
                {decrypted}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hash Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-fuchsia-400">
            <HashIcon className="h-5 w-5" />
            Hash (SHA-256)
          </CardTitle>
          <CardDescription>
            Compute SHA-256 hash of the passcode (used for masterKeyHash)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleHash} className="gap-2" variant="secondary">
            <HashIcon className="h-4 w-4" />
            Hash Passcode
          </Button>
          {hashResult && (
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  SHA-256 Hash (Base64)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(hashResult, 'hash')}
                >
                  {copied === 'hash' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <code className="text-xs font-mono text-fuchsia-400 break-all">
                {hashResult}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Feedback Section */}
      <div aria-live="polite" className="space-y-2">
        {operation && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Info className="h-4 w-4" />
            <span>{operation}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Error: {error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/crypto-test')({ component: CryptoTest })
