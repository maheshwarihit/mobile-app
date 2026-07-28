"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Loader2, type LucideIcon } from "lucide-react";

// ── Buttons ───────────────────────────────────────────────────────
type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
};

export function PrimaryButton({ children, onClick, type = "button", disabled, loading, fullWidth, icon: Icon }: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick, type = "button", disabled, loading, fullWidth, icon: Icon }: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function DangerButton({ children, onClick, type = "button", disabled, loading, fullWidth, icon: Icon }: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function SmallPrimaryButton({ children, onClick, icon: Icon }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white active:opacity-80"
    >
      {children}
      {Icon ? <Icon size={14} /> : null}
    </button>
  );
}

export function TextButton({ children, onClick, icon: Icon }: { children: ReactNode; onClick?: () => void; icon?: LucideIcon }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 active:opacity-70">
      {Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, onClick, danger }: { icon: LucideIcon; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white active:opacity-70 ${danger ? "text-danger" : "text-gray-600"}`}
    >
      <Icon size={15} />
    </button>
  );
}

// ── Inputs ───────────────────────────────────────────────────────
export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required,
  type = "text",
  icon: Icon,
  editable = true,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  type?: string;
  icon?: LucideIcon;
  editable?: boolean;
}) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </span>
      ) : null}
      <span className="relative block">
        {Icon ? <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /> : null}
        <input
          type={type}
          value={value}
          disabled={!editable}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400 ${Icon ? "pl-9" : ""} ${error ? "border-danger" : "border-gray-200"}`}
        />
      </span>
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function TextareaInput({
  label,
  value,
  onChangeText,
  placeholder,
  rows = 3,
  maxLength,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span> : null}
      <textarea
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span> : null}
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Layout ───────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-100 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {Icon ? <Icon size={18} className="text-brand-600" /> : null}
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Pill({ children, bgClass, textClass }: { children: ReactNode; bgClass: string; textClass: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${bgClass} ${textClass}`}>{children}</span>;
}

// ── Feedback ─────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-danger">{message}</div>;
}

export function WarningBanner({ message }: { message: string }) {
  return <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-warn">{message}</div>;
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
      <Loader2 size={16} className="animate-spin" />
      {message}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-12 text-center">
      {Icon ? <Icon size={28} className="text-gray-300" /> : null}
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description ? <p className="max-w-xs text-xs text-gray-500">{description}</p> : null}
      {actionLabel && onAction ? (
        <div className="mt-2">
          <OutlineButton onClick={onAction}>{actionLabel}</OutlineButton>
        </div>
      ) : null}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDanger,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
      <div className="mb-5">{children}</div>
      <div className="flex justify-end gap-2">
        <OutlineButton onClick={onClose}>{cancelLabel}</OutlineButton>
        {confirmDanger ? (
          <DangerButton onClick={onConfirm}>{confirmLabel}</DangerButton>
        ) : (
          <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
        )}
      </div>
    </Modal>
  );
}

// ── Page chrome ──────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {onBack ? (
        <button type="button" onClick={onBack} className="rounded-lg p-1 text-brand-600 active:opacity-70">
          <ChevronLeft size={22} />
        </button>
      ) : null}
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function AdminHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-admin-border bg-admin-bg px-5 py-4">
      {onBack ? (
        <button type="button" onClick={onBack} className="text-admin-accent active:opacity-70">
          <ChevronLeft size={22} />
        </button>
      ) : null}
      <h1 className="flex-1 text-base font-bold text-admin-text">{title}</h1>
      {right}
    </div>
  );
}

// ── Image picker (browser file input) ─────────────────────────────
export type PickedFile = { file: File; previewUrl: string };

export function ImagePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PickedFile | null;
  onChange: (v: PickedFile | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (file: File | undefined) => {
    if (!file) return;
    onChange({ file, previewUrl: URL.createObjectURL(file) });
  };

  useEffect(() => {
    return () => {
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition ${dragOver ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-gray-50"}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.previewUrl} alt="Selected" className="h-40 w-full rounded-lg object-contain" />
        ) : (
          <p className="text-xs text-gray-500">Click or drag an image here (PNG, JPG, or WEBP, max 5 MB)</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {value ? (
        <div className="mt-2">
          <OutlineButton onClick={() => onChange(null)}>Remove</OutlineButton>
        </div>
      ) : null}
    </div>
  );
}
