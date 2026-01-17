import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useState } from 'react'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'

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
  deriveKey,
  encrypt,
  hash,
  generateSalt,
} from '@/lib/crypto'

function NewProject() {
  const navigate = useNavigate()
  const createProject = useMutation(api.projects.create)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [masterKey, setMasterKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    if (passcode.length < 6) {
      setError('Passcode must be at least 6 characters')
      return
    }
    if (passcode !== confirmPasscode) {
      setError('Passcodes do not match')
      return
    }
    if (!masterKey.trim()) {
      setError('Master key is required for recovery')
      return
    }

    setIsLoading(true)

    try {
      // 1. Hash the master key
      const masterKeyHash = await hash(masterKey)

      // 2. Generate salt for passcode encryption
      const passcodeSalt = generateSalt()

      // 3. Derive key from master key (for encrypting passcode)
      const recoveryKey = await deriveKey(masterKey, passcodeSalt)

      // 4. Encrypt the passcode with the recovery key
      const { encryptedValue, iv, authTag } = await encrypt(passcode, recoveryKey)

      // 5. Create the project in Convex
      const projectId = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        encryptedPasscode: encryptedValue,
        masterKeyHash,
        passcodeSalt,
        iv,
        authTag,
      })

      // Navigate to the new project
      navigate({ to: '/projects/$projectId', params: { projectId } })
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground">
            Set up a new project with secure environment variables
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Basic information about your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Security Configuration
            </CardTitle>
            <CardDescription>
              Set up your passcode and master key for encryption
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
              <p className="font-medium text-primary mb-2">Important Security Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  <strong>Passcode</strong>: Used to encrypt/decrypt your secrets.
                  You'll need this to access variables.
                </li>
                <li>
                  <strong>Master Key</strong>: Used to recover your passcode if
                  forgotten. Store it safely offline.
                </li>
                <li>
                  These are <strong>never</strong> sent to or stored on our servers
                  in plain text.
                </li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="passcode">Passcode *</Label>
              <Input
                id="passcode"
                type="password"
                placeholder="Enter a secure passcode (min 6 characters)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPasscode">Confirm Passcode *</Label>
              <Input
                id="confirmPasscode"
                type="password"
                placeholder="Confirm your passcode"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="masterKey">Master Key (Recovery) *</Label>
              <Input
                id="masterKey"
                type="password"
                placeholder="Enter a strong master key"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Write this down and store it securely. It's the only way to
                recover your passcode.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-4">
          <Link to="/">
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </form>
    </div>
  )
}

export const Route = createFileRoute('/projects/new')({
  component: NewProject,
})
