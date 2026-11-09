"use client";

import Link from "next/link";
import { useActionState, type ComponentProps } from "react";

import { submitLead, type LeadFormState } from "@/app/actions/lead";
import { Button } from "@/components/ui/Button";
import { lead } from "@/content/home";
import { cn } from "@/lib/cn";

const initialState: LeadFormState = { status: "idle" };

export function LeadForm() {
  const [state, formAction, pending] = useActionState(submitLead, initialState);

  if (state.status === "success") {
    return (
      <p role="status" className="mt-6 rounded-[24px] bg-white/12 p-5 text-lg leading-snug text-white lg:text-xl">
        {state.message ?? "Спасибо! Мы свяжемся с вами."}
      </p>
    );
  }

  const { errors, values } = state;

  return (
    <form action={formAction} noValidate className="mt-3.5 flex flex-col lg:mt-[66px]">
      <div className="flex flex-col gap-5">
        <Field
          name="name"
          label="Ваше имя"
          autoComplete="name"
          defaultValue={values?.name}
          error={errors?.name}
        />
        <Field
          name="phone"
          label="Номер телефона"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={values?.phone}
          error={errors?.phone}
        />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          defaultValue={values?.email}
          error={errors?.email}
        />
      </div>

      {/* Honeypot против ботов */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Компания
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-5">
        <label className="flex cursor-pointer items-start gap-2 text-lg leading-[22px] text-white">
          <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center">
            <input
              type="checkbox"
              name="consent"
              required
              aria-invalid={Boolean(errors?.consent)}
              aria-describedby={errors?.consent ? "consent-error" : undefined}
              className="peer absolute inset-0 cursor-pointer appearance-none bg-white transition-colors checked:bg-blue"
            />
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="pointer-events-none relative size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
            >
              <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <span>
            Даю{" "}
            <Link href="/consent" className="underline-offset-2 hover:underline">
              согласие на обработку персональных данных
            </Link>{" "}
            и ознакомлен(а) с{" "}
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              политикой конфиденциальности
            </Link>
          </span>
        </label>
        {errors?.consent && <FieldError id="consent-error">{errors.consent}</FieldError>}
      </div>

      <Button type="submit" disabled={pending} className="mt-2.5 lg:mt-7">
        {pending ? "Отправляем…" : lead.submit}
      </Button>

      {state.message && (
        <p role="alert" className="px-3 text-base text-[#ffb4b4]">
          {state.message}
        </p>
      )}
    </form>
  );
}

type FieldProps = ComponentProps<"input"> & { name: string; label: string; error?: string };

function Field({ name, label, error, className, ...props }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={`lead-${name}`} className="sr-only">
        {label}
      </label>
      <input
        id={`lead-${name}`}
        name={name}
        placeholder={`${label}:`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-[42px] w-full rounded-[10px] bg-white px-4 text-lg text-navy outline-none placeholder:text-muted",
          "transition-shadow focus-visible:ring-3 focus-visible:ring-blue/60",
          error && "ring-2 ring-[#ff7a7a]",
          className,
        )}
        {...props}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 px-5 text-sm text-[#ffb4b4]">
      {children}
    </p>
  );
}
