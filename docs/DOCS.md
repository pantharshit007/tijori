# Environment Variable Management - Architecture Documentation

## Overview

The environment variable management module provides a comprehensive UI for viewing, editing, and managing encrypted environment variables within the Tijori secrets manager.

## Directory Structure

```text
src/
├── lib/
│   ├── types.ts          # Shared types (ParsedVariable, BulkEditVariable, etc.)
│   └── utils.ts          # Pure utility functions (parseBulkInput, variablesToExport)
├── components/
│   └── environment-variables/
│       ├── index.ts              # Barrel export
│       ├── EnvironmentVariables.tsx  # Main container component
│       ├── VariableRow.tsx       # Single variable display (memoized)
│       ├── VariableEditRow.tsx   # Inline edit row
│       ├── BulkAddDialog.tsx     # Bulk add dialog
│       ├── BulkEditDialog.tsx    # Bulk edit dialog (table + raw modes)
│       └── useVariableActions.ts # Custom hook for reveal/copy logic
```

## Key Types

| Type                        | Location       | Description                           |
| --------------------------- | -------------- | ------------------------------------- |
| `EnvironmentVariablesProps` | `lib/types.ts` | Props for the main component          |
| `ParsedVariable`            | `lib/types.ts` | Parsed key-value pair from bulk input |
| `BulkEditVariable`          | `lib/types.ts` | Tracked variable in bulk edit mode    |
| `Variable`                  | `lib/types.ts` | Encrypted variable from database      |

## Utility Functions

| Function                  | Location       | Description                                         |
| ------------------------- | -------------- | --------------------------------------------------- |
| `parseBulkInput(input)`   | `lib/utils.ts` | Parses KEY=VALUE, export KEY=VALUE, quoted values   |
| `variablesToExport(vars)` | `lib/utils.ts` | Converts variables to exportable KEY="VALUE" format |

## Components

### `EnvironmentVariables` (Main)

Orchestrates all subcomponents and manages state for:

- Single variable add/edit
- Bulk add/edit dialogs
- Integration with Convex mutations

### `VariableRow` (Memoized)

Displays a single variable with reveal, copy, edit, and delete actions. Wrapped in `React.memo` for performance when rendering lists.

### `VariableEditRow`

Inline editor with Name and Value inputs. Handles ESC to cancel and Enter to save.

### `BulkAddDialog`

Paste multiple variables, preview with validation, add all at once with progress indicator.

### `BulkEditDialog`

Edit multiple variables in table view or raw text mode. Tracks changes for save/delete operations.

## Custom Hooks

### `useVariableActions`

Centralizes reveal, copy, and decryption state management:

- `revealedVars` - Set of revealed variable IDs
- `decryptedValues` - Cache of decrypted values
- `handleReveal()` / `handleCopy()` - Actions with decryption

## Performance Considerations

1. **Memoization**: `VariableRow` is wrapped in `React.memo` to prevent unnecessary re-renders in lists.
2. **Decryption Caching**: Decrypted values are cached in state to avoid repeated decryption.
3. **No Virtualization**: Not implemented as variable lists are typically small. Revisit if lists grow large.

## Extending the Module

1. **New utility functions**: Add to `lib/utils.ts` (must be pure, no component dependencies)
2. **New types**: Add to `lib/types.ts`
3. **New subcomponents**: Create in `environment-variables/` and export from `index.ts`
4. **New hooks**: Create as `use*.ts` in the same directory
