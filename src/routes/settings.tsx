import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { KeyRound, Loader2, Check, AlertTriangle } from 'lucide-react'

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

import { hash, generateSalt } from '@/lib/crypto'

function Settings() {
  const user = useQuery(api.users.me)
  const setMasterKey = useMutation(api.users.setMasterKey)

  const [masterKey, setMasterKeyInput] = useState('')
  const [confirmMasterKey, setConfirmMasterKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const hasMasterKey = user?.masterKeyHash !== undefined

  async function handleSetMasterKey(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!masterKey.trim()) {
      setError('Master key is required')
      return
    }
    if (masterKey.length < 8) {
      setError('Master key must be at least 8 characters')
      return
    }
    if (masterKey !== confirmMasterKey) {
      setError('Master keys do not match')
      return
    }

    setIsLoading(true)

    try {
      const masterKeyHash = await hash(masterKey)
      const masterKeySalt = generateSalt()

      await setMasterKey({ masterKeyHash, masterKeySalt })
      setSuccess(true)
      setMasterKeyInput('')
      setConfirmMasterKey('')
    } catch (err: any) {
      setError(err.message || 'Failed to set master key')
    } finally {
      setIsLoading(false)
    }
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and security</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Master Key
          </CardTitle>
          <CardDescription>
            Your master key is used to encrypt project passcodes. This is the
            only way to recover access if you forget a project passcode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasMasterKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-500">
                <Check className="h-4 w-4" />
                Master key is configured
              </div>
              <p className="text-sm text-muted-foreground">
                To update your master key, enter a new one below. Note: This
                will require re-encrypting all your project passcodes.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-500 mb-4">
              <AlertTriangle className="h-4 w-4" />
              No master key set. You'll need to set one before creating projects.
            </div>
          )}

          <form onSubmit={handleSetMasterKey} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="masterKey">
                {hasMasterKey ? 'New Master Key' : 'Master Key'}
              </Label>
              <Input
                id="masterKey"
                type="password"
                placeholder="Enter a strong master key (min 8 chars)"
                value={masterKey}
                onChange={(e) => setMasterKeyInput(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmMasterKey">Confirm Master Key</Label>
              <Input
                id="confirmMasterKey"
                type="password"
                placeholder="Confirm your master key"
                value={confirmMasterKey}
                onChange={(e) => setConfirmMasterKey(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                <Check className="h-4 w-4" />
                Master key {hasMasterKey ? 'updated' : 'set'} successfully!
              </div>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasMasterKey ? 'Update Master Key' : 'Set Master Key'}
            </Button>
          </form>

          <div className="mt-6 p-4 rounded-lg bg-muted text-sm">
            <p className="font-medium mb-2">⚠️ Important Security Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                Your master key is <strong>never</strong> stored on our servers.
              </li>
              <li>Only a hash of your master key is stored for verification.</li>
              <li>If you lose your master key, you cannot recover project passcodes.</li>
              <li>Write it down and store it in a safe place.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/settings')({
  component: Settings,
})
