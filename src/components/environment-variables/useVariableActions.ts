import { useCallback, useState } from "react";
import { decrypt } from "@/lib/crypto";

export interface UseVariableActionsProps {
  derivedKey: CryptoKey | null;
}

/**
 * Custom hook for managing variable reveal, copy, and decryption states.
 * Centralizes common variable interaction logic.
 */
export function useVariableActions({ derivedKey }: UseVariableActionsProps) {
  const [revealedVars, setRevealedVars] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [decryptErrors, setDecryptErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const reset = useCallback(() => {
    setRevealedVars(new Set());
    setDecryptedValues({});
    setDecryptErrors({});
    setCopied(null);
  }, []);

  const handleReveal = useCallback(async (
    varId: string,
    encryptedValue: string,
    iv: string,
    authTag: string
  ) => {
    if (!derivedKey) return;

    if (revealedVars.has(varId)) {
      setRevealedVars(prev => {
        const next = new Set(prev);
        next.delete(varId);
        return next;
      });
      return;
    }

    try {
      setDecryptErrors(prev => ({ ...prev, [varId]: "" }));
      const decrypted = await decrypt(encryptedValue, iv, authTag, derivedKey);
      setDecryptedValues(prev => ({ ...prev, [varId]: decrypted }));
      setRevealedVars(prev => new Set(prev).add(varId));
    } catch (err) {
      console.error("Failed to decrypt:", err);
      setDecryptErrors(prev => ({ ...prev, [varId]: "Decryption failed." }));
    }
  }, [derivedKey, revealedVars]);

  const handleCopy = useCallback(async (
    varId: string,
    encryptedValue: string,
    iv: string,
    authTag: string
  ) => {
    if (!derivedKey) return;

    try {
      let value = decryptedValues[varId];
      if (value === undefined) {
        value = await decrypt(encryptedValue, iv, authTag, derivedKey);
      }
      await navigator.clipboard.writeText(value);
      setCopied(varId);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [derivedKey, decryptedValues]);

  return {
    revealedVars,
    decryptedValues,
    decryptErrors,
    copied,
    setCopied,
    setDecryptedValues,
    reset,
    handleReveal,
    handleCopy,
  };
}
