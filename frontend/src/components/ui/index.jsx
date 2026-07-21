"use client";
/* ══════════════════════════════════════════════════════════════════════
   DS DESIGN SYSTEM — SHARED COMPONENT PATTERNS
   Copy-paste-ready JSX components for all internal tools.

   HOW TO USE:
   1. Import design_tokens.css globally in your app.
   2. Copy this file into your project as /src/components/ui/index.jsx
      (or keep individual components in separate files)
   3. Import what you need:
      import { PrimaryButton, Card, StatusPill } from '@/components/ui';

   DEPENDENCIES: lucide-react (icons)
   STYLING: TailwindCSS
   TOKENS: design_tokens.css (import globally)

   VERSION: 2.0.0
   ══════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight,
  Eye, EyeOff, X, Plus, Check,
  AlertTriangle, Search, Calendar,
  Upload, MoreVertical, Info,
} from "lucide-react";

// ══════════════════════════════════════════════
// BUTTONS
// ══════════════════════════════════════════════

/** Full-width or auto-width primary action button */
export function PrimaryButton({ onClick, children, disabled, fullWidth, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** Secondary / cancel button */
export function OutlineButton({ onClick, children, disabled, fullWidth, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-gray-300 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** Destructive confirmation button */
export function DangerButton({ onClick, children, disabled, fullWidth, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-red-200 text-red-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** Compact inline size variant — use for card headers */
export function SmallPrimaryButton({ onClick, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

/** Icon-only action button (table actions, toolbar) */
export function IconButton({ onClick, children, title, danger = false }) {
  const base = "p-2 rounded-lg transition-colors";
  const color = danger
    ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
    : "text-gray-400 hover:text-purple-600 hover:bg-gray-50";
  return (
    <button onClick={onClick} title={title} className={`${base} ${color}`}>
      {children}
    </button>
  );
}

/** Ghost button — hamburger, close, subtle actions */
export function GhostButton({ onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
    >
      {children}
    </button>
  );
}

/** Text-only link-style button */
export function TextButton({ onClick, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

// ══════════════════════════════════════════════
// FORM INPUTS
// ══════════════════════════════════════════════

/** Standard text / email / number input with label and optional icon */
export function FormInput({
  label, type = "text", value, onChange, placeholder,
  error, locked = false, icon: Icon, required = false,
  id, ...rest
}) {
  const lockedClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 cursor-not-allowed";
  const editClass   = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors";
  const inputClass  = `${locked ? lockedClass : editClass} ${Icon ? "pl-10" : ""}`;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}{required && " *"}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon size={16} className="text-gray-400" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={locked}
          className={inputClass}
          {...rest}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/** Select / dropdown with label */
export function SelectInput({ label, value, onChange, options, error, required = false, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}{required && " *"}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 appearance-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors"
        >
          {options.map((opt) =>
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/** Password input with show/hide toggle */
export function PasswordInput({ label, value, onChange, placeholder, error, id }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/** Textarea with char counter and label */
export function TextareaInput({ label, value, onChange, placeholder, error, maxLength, rows = 6, required = false, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}{required && " *"}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors resize-none"
      />
      <div className="flex justify-between mt-1">
        {error
          ? <p className="text-xs text-red-500">{error}</p>
          : <span />}
        {maxLength && (
          <span className="text-xs text-gray-400">{value?.length ?? 0}/{maxLength}</span>
        )}
      </div>
    </div>
  );
}

/** Search input — standalone filter bar element */
export function SearchInput({ value, onChange, placeholder = "Search...", id }) {
  return (
    <div className="relative flex-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search size={16} className="text-gray-400" />
      </div>
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors"
      />
    </div>
  );
}

// ══════════════════════════════════════════════
// CARDS
// ══════════════════════════════════════════════

/** Base white card */
export function Card({ children, className = "", hover = false }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${hover ? "hover:shadow-md transition-all" : ""} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Form section card with icon header
 * iconBg: Tailwind bg class e.g. "bg-purple-50"
 * iconColor: Tailwind text class e.g. "text-purple-600"
 */
export function SectionCard({ icon: Icon, iconBg = "bg-purple-50", iconColor = "text-purple-600", title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Standard page header with title, subtitle, and optional CTA button */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════
// PILLS & BADGES
// ══════════════════════════════════════════════

const STATUS_MAP = {
  Active:     "bg-emerald-50 text-emerald-700",
  Draft:      "bg-blue-50 text-blue-600",
  Hold:       "bg-amber-50 text-amber-700",
  Closed:     "bg-gray-100 text-gray-500",
  Scheduled:  "bg-blue-50 text-blue-700",
  Completed:  "bg-emerald-50 text-emerald-700",
  Cancelled:  "bg-red-50 text-red-700",
};

const STAGE_MAP = {
  "Applied":              "bg-blue-50 text-blue-700",
  "AI Pre-Screening":     "bg-purple-50 text-purple-700",
  "Interview Scheduled":  "bg-amber-50 text-amber-700",
  "L1 Select":            "bg-emerald-50 text-emerald-700",
  "L1 Reject":            "bg-red-50 text-red-700",
};

/** Status pill — Active, Draft, Hold, Closed, Scheduled, Completed, Cancelled */
export function StatusPill({ status }) {
  const colors = STATUS_MAP[status] ?? "bg-gray-50 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}

/** Stage pill — candidate pipeline stages */
export function StagePill({ stage }) {
  const colors = STAGE_MAP[stage] ?? "bg-gray-50 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colors}`}>
      {stage}
    </span>
  );
}

/** Generic colored label pill — pass any bg + text Tailwind classes */
export function Pill({ children, bgClass = "bg-gray-100", textClass = "text-gray-600" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bgClass} ${textClass}`}>
      {children}
    </span>
  );
}

/** Skill or tag chip with optional remove button */
export function SkillChip({ label, onRemove, variant = "purple" }) {
  const colors = variant === "blue"
    ? "bg-blue-50 text-blue-700 hover:text-blue-900"
    : "bg-purple-50 text-purple-700 hover:text-purple-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${colors}`}>
      {label}
      {onRemove && (
        <button onClick={onRemove} className="transition-colors">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

// ══════════════════════════════════════════════
// AVATAR
// ══════════════════════════════════════════════

const AVATAR_COLORS = [
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
];

/**
 * Initials avatar — color auto-assigned from id string
 * size: "sm" (32px) | "md" (40px)
 */
export function Avatar({ firstName, lastName, id = "0", size = "md" }) {
  const initials = `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
  const color = AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full ${color} flex items-center justify-center font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ══════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════

/** Centered empty state with icon, title, description, and optional action */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Icon size={24} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 text-center max-w-md mb-3">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
        >
          <Plus size={14} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════

/**
 * Confirmation modal shell
 * confirmDanger: true → uses DangerButton for confirm
 */
export function ConfirmModal({
  open, title, children, onClose, onConfirm,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  confirmDanger = false, size = "md",
}) {
  if (!open) return null;
  const maxW = size === "lg" ? "max-w-lg" : "max-w-md";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full ${maxW} p-6 z-10`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <GhostButton onClick={onClose} title="Close">
            <X size={18} />
          </GhostButton>
        </div>
        <div className="mb-6">{children}</div>
        <div className="flex items-center gap-3 justify-end">
          <OutlineButton onClick={onClose}>{cancelLabel}</OutlineButton>
          {confirmDanger
            ? <DangerButton onClick={onConfirm}>{confirmLabel}</DangerButton>
            : <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
          }
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// PAGINATION
// ══════════════════════════════════════════════

/** Standard page-number pagination bar */
export function Pagination({ current, total, onPage }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <span className="text-sm text-gray-500">Page {current} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(1, current - 1))}
          disabled={current === 1}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
              p === current
                ? "bg-purple-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(Math.min(total, current + 1))}
          disabled={current === total}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// STATUS PROGRESS BAR
// ══════════════════════════════════════════════

/**
 * Labeled progress bar row — e.g. Candidate Status panel
 * barColor: Tailwind bg class e.g. "bg-purple-500"
 * pillBg/pillText: Tailwind classes for the label pill
 */
export function StatusBar({ label, count, max, barColor = "bg-purple-500", pillBg = "bg-purple-50", pillText = "text-purple-700" }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className={`rounded-md px-2 py-1 text-[11px] font-medium w-32 truncate text-center flex-shrink-0 ${pillBg} ${pillText}`}>
        {label}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${barColor} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-7 text-right flex-shrink-0">{count}</span>
    </div>
  );
}

// ══════════════════════════════════════════════
// DATE FILTER PILL
// ══════════════════════════════════════════════

/**
 * Clickable date range dropdown pill
 * options: array of strings e.g. ["Last 7 Days", "Last 30 Days"]
 * big: true for larger variant (page-level filter), false for card-level
 */
export function DateFilterPill({ value, onChange, options = ["Last 7 Days", "Last 30 Days"], big = false }) {
  const [open, setOpen] = useState(false);
  const triggerClass = big
    ? "inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-600 cursor-pointer hover:border-gray-300 shadow-sm select-none"
    : "inline-flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1 bg-white text-[11px] text-gray-600 cursor-pointer hover:border-gray-300 flex-shrink-0 whitespace-nowrap select-none";
  const iconSize = big ? 14 : 11;

  return (
    <div className="relative">
      <div onClick={() => setOpen(!open)} className={triggerClass}>
        <Calendar size={iconSize} className="text-gray-400" />
        <span className="font-medium">{value}</span>
        <ChevronDown size={iconSize} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 min-w-[140px] py-1">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange?.(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${opt === value ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// NOTIFICATION BADGE
// ══════════════════════════════════════════════

/** Red dot badge for notification counts — overlay on an icon */
export function NotificationBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ══════════════════════════════════════════════
// ALERT BANNERS (inline form messages)
// ══════════════════════════════════════════════

/** Inline error banner — e.g. login failure, form error summary */
export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
      <AlertTriangle size={16} className="flex-shrink-0" />
      {message}
    </div>
  );
}

/** Inline warning notice — e.g. "this action cannot be undone" */
export function WarningBanner({ message }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
      <AlertTriangle size={16} className="flex-shrink-0" />
      {message}
    </div>
  );
}

// ══════════════════════════════════════════════
// TABLE
// ══════════════════════════════════════════════

/**
 * Data table with header, sortable columns, and row click handler
 * columns: [{ key, label, align?, render?, sortable?, width? }]
 * data: array of row objects
 */
export function DataTable({ columns, data, onRowClick, sortKey, sortDir, onSort, emptyIcon, emptyTitle }) {
  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    const dir = sortKey === col.key && sortDir === "asc" ? "desc" : "asc";
    onSort(col.key, dir);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.sortable ? "cursor-pointer select-none hover:text-gray-700" : ""} ${col.align === "center" ? "text-center" : ""}`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => handleSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-purple-600">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  icon={emptyIcon || Search}
                  title={emptyTitle || "No data found"}
                />
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-3.5 text-sm text-gray-700 ${col.align === "center" ? "text-center" : ""}`}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════
// LAYOUT SHELL — HEADER + SIDEBAR
// ══════════════════════════════════════════════

/**
 * App shell header — fixed top bar
 * left: logo/name area, right: user avatar + actions
 */
export function AppHeader({ appName, onToggleSidebar, children }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6"
      style={{ backgroundColor: "#F9F7FF" }}
    >
      <div className="flex items-center gap-3">
        <GhostButton onClick={onToggleSidebar} title="Toggle sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </GhostButton>
        <span className="text-base font-semibold text-gray-900">{appName}</span>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}

/**
 * Sidebar navigation
 * items: [{ key, label, icon: LucideIcon, badge? }]
 * activeKey: currently selected item key
 */
export function Sidebar({ items, activeKey, onSelect, collapsed = false }) {
  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 z-30 flex flex-col py-4 px-3 transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
      style={{ backgroundColor: "#F9F7FF" }}
    >
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-purple-50 text-purple-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {Icon && <Icon size={20} className={active ? "text-purple-600" : "text-gray-400"} />}
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge != null && (
                <span className="ml-auto text-xs font-semibold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * Main content area wrapper — handles sidebar offset and content bg
 */
export function MainContent({ collapsed = false, children }) {
  return (
    <main className={`pt-16 transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"}`}>
      <div className="p-3">
        <div className="bg-gray-50 rounded-2xl min-h-[calc(100vh-5rem)] p-6">
          {children}
        </div>
      </div>
    </main>
  );
}

// ══════════════════════════════════════════════
// BREADCRUMB
// ══════════════════════════════════════════════

/**
 * Breadcrumb navigation
 * items: [{ label, onClick? }] — last item is the current page (no click)
 */
export function Breadcrumb({ items, homeIcon: HomeIcon }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4 -mt-1">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronRight size={12} className="text-gray-300" />}
            {idx === 0 && HomeIcon && <HomeIcon size={14} className="text-gray-400" />}
            {isLast ? (
              <span className="text-gray-700 font-medium">{item.label}</span>
            ) : (
              <button
                onClick={item.onClick}
                className="text-gray-400 hover:text-purple-600 transition-colors"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ══════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════

/**
 * Horizontal tab bar
 * tabs: [{ key, label, count? }]
 */
export function TabBar({ tabs, activeKey, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              active
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${
                active ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// LOADING & SKELETON
// ══════════════════════════════════════════════

/** Spinner — use for button loading, inline loading, or full-page overlay */
export function Spinner({ size = "md", className = "" }) {
  const sz = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }[size] || "w-6 h-6";
  return (
    <svg
      className={`animate-spin text-purple-600 ${sz} ${className}`}
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Full centered loading state — use as page-level or card-level placeholder */
export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size="lg" />
      <p className="text-sm text-gray-500 mt-3">{message}</p>
    </div>
  );
}

/** Skeleton shimmer block — compose multiple for skeleton screens */
export function Skeleton({ width = "100%", height = "16px", rounded = "rounded-lg", className = "" }) {
  return (
    <div
      className={`bg-gray-200 animate-pulse ${rounded} ${className}`}
      style={{ width, height }}
    />
  );
}

/** Pre-composed skeleton row for table loading states */
export function SkeletonTableRows({ columns = 4, rows = 5 }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              width={c === 0 ? "40%" : "20%"}
              height="14px"
              rounded="rounded"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// TOAST / NOTIFICATIONS
// ══════════════════════════════════════════════

const TOAST_STYLES = {
  success: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: Check },
  error:   { bg: "bg-red-50 border-red-200", text: "text-red-600", icon: AlertTriangle },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", icon: AlertTriangle },
  info:    { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: AlertTriangle },
};

/**
 * Toast notification — position via a container.
 * Typically rendered inside a fixed top-right ToastContainer.
 */
export function Toast({ message, type = "success", onDismiss }) {
  const style = TOAST_STYLES[type] || TOAST_STYLES.info;
  const IconComp = style.icon;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border shadow-md ${style.bg} min-w-[300px] max-w-md`}>
      <IconComp size={16} className={`flex-shrink-0 ${style.text}`} />
      <span className={`text-sm font-medium flex-1 ${style.text}`}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Fixed-position toast container — top right, stacks toasts vertically */
export function ToastContainer({ children }) {
  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2">
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════
// TOGGLE / SWITCH
// ══════════════════════════════════════════════

/** Toggle switch — boolean on/off control */
export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`inline-flex items-center gap-3 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
          checked ? "bg-purple-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

// ══════════════════════════════════════════════
// CHECKBOX
// ══════════════════════════════════════════════

/** Styled checkbox with label */
export function Checkbox({ checked, onChange, label, disabled = false, id }) {
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-2.5 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-purple-600 peer-checked:border-purple-600 peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500/20 transition-colors flex items-center justify-center">
          {checked && <Check size={14} className="text-white" strokeWidth={3} />}
        </div>
      </div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

// ══════════════════════════════════════════════
// FILE UPLOAD DROPZONE
// ══════════════════════════════════════════════

/**
 * Drag-and-drop file upload area
 * accept: file type string e.g. ".pdf,.docx"
 * maxSizeMB: max file size in megabytes
 */
export function FileUpload({ onFile, accept, maxSizeMB = 10, label, description }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = (file) => {
    setError(null);
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMB}MB limit`);
      return;
    }
    onFile?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("_file_input")?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-purple-400 bg-purple-50/50"
            : "border-gray-300 hover:border-gray-400 bg-white"
        }`}
      >
        <input
          id="_file_input"
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-600">
          {description || "Drag & drop a file, or click to browse"}
        </p>
        {accept && <p className="text-xs text-gray-400 mt-1">Accepted: {accept}</p>}
        {maxSizeMB && <p className="text-xs text-gray-400">Max size: {maxSizeMB}MB</p>}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════
// DROPDOWN ACTION MENU
// ══════════════════════════════════════════════

/**
 * Three-dot action menu — for table rows, card headers
 * actions: [{ label, onClick, danger?, icon?: LucideIcon }]
 */
export function ActionMenu({ actions }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 min-w-[160px] py-1">
            {actions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); action.onClick(); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    action.danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {Icon && <Icon size={14} />}
                  {action.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// TOOLTIP
// ══════════════════════════════════════════════

/**
 * Hover tooltip — wraps any element
 * position: "top" | "bottom" | "left" | "right"
 */
export function Tooltip({ children, text, position = "top" }) {
  const [show, setShow] = useState(false);
  const positionClasses = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}>
          <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// SUCCESS BANNER (completes the banner family)
// ══════════════════════════════════════════════

/** Inline success banner — e.g. "Changes saved successfully" */
export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
      <Check size={16} className="flex-shrink-0" />
      {message}
    </div>
  );
}
