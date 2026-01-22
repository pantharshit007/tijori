// Barrel export for environment-variables module
export { EnvironmentVariables } from "./EnvironmentVariables";
export { VariableRow } from "./VariableRow";
export { VariableEditRow } from "./VariableEditRow";
export { BulkAddDialog } from "./BulkAddDialog";
export { BulkEditDialog } from "./BulkEditDialog";
export { useVariableActions } from "./useVariableActions";

// Re-export types from central location
export type { EnvironmentVariablesProps, ParsedVariable, BulkEditVariable } from "@/lib/types";
