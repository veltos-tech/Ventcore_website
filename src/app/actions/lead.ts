"use server";

import { notifyLead } from "@/lib/notify";
import { headers } from "next/headers";

type Field = "name" | "phone" | "email" | "consent";

export type LeadFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<Field, string>>;
  values?: { name: string; phone: string; email: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const read = (key: string) => String(formData.get(key) ?? "").trim();

  // Honeypot: поле скрыто от людей, боты его заполняют. Отвечаем «успехом», ничего не отправляя.
  if (read("company")) return { status: "success" };

  const values = { name: read("name").replace(/\s+/g, " "), phone: read("phone").replace(/\s+/g, " "), email: read("email") };
  const errors: LeadFormState["errors"] = {};

  if (values.name.length < 2 || values.name.length > 80 || /[\u0000-\u001f\u007f]/u.test(values.name)) errors.name = "Укажите имя";
  const digits = values.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || values.phone.length > 40 || !/^[\d+() .-]+$/.test(values.phone)) errors.phone = "Проверьте номер телефона";
  if (values.email && (values.email.length > 254 || !EMAIL_RE.test(values.email))) errors.email = "Проверьте email";
  if (formData.get("consent") !== "on") errors.consent = "Для отправки заявки необходимо согласие на обработку персональных данных";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const requestHeaders = await headers();
    const clientKey = process.env.CRM_TRUST_PROXY === "1" ? (requestHeaders.get("x-real-ip") ?? "unknown").slice(0, 128) : "unknown";
    const accepted = await notifyLead({ ...values, email: values.email || undefined }, clientKey);
    if (!accepted) return { status: "error", message: "Слишком много заявок. Попробуйте позже.", values };
  } catch {
    console.error("[lead] не удалось сохранить заявку");
    return {
      status: "error",
      message: "Не удалось отправить заявку. Попробуйте ещё раз или напишите нам на почту.",
      values,
    };
  }

  return {
    status: "success",
    message: "Спасибо! Инженер VentCore свяжется с вами в ближайшее время.",
  };
}
