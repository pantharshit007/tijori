import { useState } from "react";
import { Check, Copy, Loader2, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hash as cryptoHash, decrypt, deriveKey } from "@/lib/crypto";

interface PasscodeRecoveryProps {
  project: {
    name: string;
    passcodeSalt: string;
    passcodeHash: string;
    encryptedPasscode: string;
    iv: string;
    authTag: string;
  };
  user: {
    masterKeyHash?: string;
    masterKeySalt?: string;
  } | null | undefined;
  onBack: () => void;
  onSuccess?: (passcode: string) => void;
}

export function PasscodeRecovery({ project, user, onBack, onSuccess }: PasscodeRecoveryProps) {
  const [masterKeyInput, setMasterKeyInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveredPasscode, setRecoveredPasscode] = useState<string | null>(null);
  const [copiedRecovered, setCopiedRecovered] = useState(false);

  async function handleRecoverPasscode() {
    if (!project || !user || !masterKeyInput) return;

    setIsRecovering(true);
    setRecoveryError(null);

    try {
      // Check if user has a master key configured
      if (!user.masterKeyHash || !user.masterKeySalt) {
        setRecoveryError("No master key configured. Go to Settings to set one.");
        setIsRecovering(false);
        return;
      }

      // Verify the master key by hashing and comparing
      const enteredHash = await cryptoHash(masterKeyInput, user.masterKeySalt);
      if (enteredHash !== user.masterKeyHash) {
        setRecoveryError("Incorrect master key. Please try again.");
        setIsRecovering(false);
        return;
      }

      // Master key verified! Now decrypt the project passcode
      const recoveryKey = await deriveKey(masterKeyInput, project.passcodeSalt);
      const decryptedPasscode = await decrypt(
        project.encryptedPasscode,
        project.iv,
        project.authTag,
        recoveryKey
      );

      setRecoveredPasscode(decryptedPasscode);
      onSuccess?.(decryptedPasscode);
    } catch (err: any) {
      console.error("Recovery failed:", err);
      setRecoveryError("Failed to recover passcode. Please check your master key.");
    } finally {
      setIsRecovering(false);
    }
  }

  async function handleCopyRecoveredPasscode() {
    if (!recoveredPasscode) return;
    await navigator.clipboard.writeText(recoveredPasscode);
    setCopiedRecovered(true);
    setTimeout(() => setCopiedRecovered(false), 2000);
  }

  if (recoveredPasscode) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-500">
            <Check className="h-5 w-5" />
            Passcode Recovered!
          </DialogTitle>
          <DialogDescription>
            Here is your 6-digit project passcode. Use it to unlock the project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-muted">
            <code className="text-2xl font-bold font-mono tracking-widest">
              {recoveredPasscode}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyRecoveredPasscode}
            >
              {copiedRecovered ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Write this down in a safe place for future use.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onBack}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldQuestion className="h-5 w-5" />
          Recover Passcode
        </DialogTitle>
        <DialogDescription>
          Enter your Master Key to decrypt and reveal the project passcode.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="masterKeyRecovery">Master Key</Label>
          <Input
            id="masterKeyRecovery"
            type="password"
            placeholder="Enter your master key"
            value={masterKeyInput}
            onChange={(e) => setMasterKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRecoverPasscode()}
            autoFocus
          />
        </div>
        {recoveryError && (
          <p className="text-sm text-destructive">{recoveryError}</p>
        )}
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleRecoverPasscode}
          disabled={isRecovering || !masterKeyInput}
        >
          {isRecovering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Recover
        </Button>
      </DialogFooter>
    </>
  );
}
