/**
 * @/ui/shell — app chrome, shared components, hooks and settings for every view module.
 */
export * from './components';
export * from './hooks';
export { AppShell } from './AppShell';
export type { AppShellProps, ViewsMap } from './AppShell';
export { Providers } from './Providers';
export type { ProvidersProps } from './Providers';
export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';
export { TopBar, BankrollPill } from './chrome/TopBar';
export type { TopBarProps } from './chrome/TopBar';
export { SettingsDialog, describeRuleProblems, localRuleProblems, cutCardRange, ruleSummary } from './settings/SettingsDialog';
export type { SettingsDialogProps, SettingsTab } from './settings/SettingsDialog';
export { MODES, DEFAULT_MODE, parseHash, toHash, navigate, isMode, modeInfo, useHashRoute } from './routing';
export type { Mode, Route, ModeInfo } from './routing';
export { PlayPlaceholder, LearnPlaceholder, LabPlaceholder, LESSON_IDS } from './placeholders';
export { formatMoney, formatMoneyCompact, formatPercent, formatNumber, formatSigned, formatOdds } from './format';
export type { MoneyOptions } from './format';
export { cx } from './cx';
