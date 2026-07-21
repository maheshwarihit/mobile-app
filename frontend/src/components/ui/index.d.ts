// Loose type declarations for the DS design-system component library
// (component_patterns.jsx). The runtime is the .jsx file; these declarations
// let TypeScript consumers use the components without over-constrained props.
import type { ComponentType } from "react";

type C = ComponentType<any>;

export const PrimaryButton: C;
export const OutlineButton: C;
export const DangerButton: C;
export const SmallPrimaryButton: C;
export const IconButton: C;
export const GhostButton: C;
export const TextButton: C;
export const FormInput: C;
export const SelectInput: C;
export const PasswordInput: C;
export const TextareaInput: C;
export const SearchInput: C;
export const Card: C;
export const SectionCard: C;
export const PageHeader: C;
export const StatusPill: C;
export const StagePill: C;
export const Pill: C;
export const SkillChip: C;
export const Avatar: C;
export const EmptyState: C;
export const ConfirmModal: C;
export const Pagination: C;
export const StatusBar: C;
export const DateFilterPill: C;
export const NotificationBadge: C;
export const ErrorBanner: C;
export const WarningBanner: C;
export const SuccessBanner: C;
export const DataTable: C;
export const AppHeader: C;
export const Sidebar: C;
export const MainContent: C;
export const Breadcrumb: C;
export const TabBar: C;
export const Spinner: C;
export const LoadingState: C;
export const Skeleton: C;
export const SkeletonTableRows: C;
export const Toast: C;
export const ToastContainer: C;
export const Toggle: C;
export const Checkbox: C;
export const FileUpload: C;
export const ActionMenu: C;
export const Tooltip: C;
