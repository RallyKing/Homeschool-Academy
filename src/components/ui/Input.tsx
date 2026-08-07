"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const fieldClass =
  "mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] shadow-sm transition-all duration-200 placeholder:text-[var(--muted-fg)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)] disabled:opacity-50";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className="block text-sm font-medium text-[var(--muted)]">
      {label}
      <input
        ref={ref}
        id={inputId}
        className={cn(fieldClass, !label && "mt-0", className)}
        {...props}
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-[var(--muted-fg)]">{hint}</span> : null}
    </label>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, id, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <label htmlFor={inputId} className="block text-sm font-medium text-[var(--muted)]">
        {label}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(fieldClass, "min-h-[5.5rem] resize-y", !label && "mt-0", className)}
          {...props}
        />
      </label>
    );
  },
);

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className="block text-sm font-medium text-[var(--muted)]">
      {label}
      <select
        ref={ref}
        id={inputId}
        className={cn(fieldClass, !label && "mt-0", className)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
});

/** Shared class for uncontrolled native fields in forms. */
export const controlClass = fieldClass;
