import "server-only";

import { requisites } from "@/content/requisites";
import { site } from "@/content/site";

// Оператор персональных данных. Значения по умолчанию берутся из реквизитов
// компании (src/content/requisites.ts); переменные LEGAL_OPERATOR_* позволяют
// переопределить их на сервере без правки кода.
const row = (label: string) => requisites.rows.find((item) => item.label === label)?.value ?? "";

export const legalOperator = {
  name: process.env.LEGAL_OPERATOR_NAME?.trim() || row("Полное наименование"),
  shortName: row("Сокращённое наименование"),
  inn: process.env.LEGAL_OPERATOR_INN?.trim() || row("ИНН"),
  kpp: row("КПП"),
  ogrn: row("ОГРН"),
  address: process.env.LEGAL_OPERATOR_ADDRESS?.trim() || row("Юридический адрес"),
  email: process.env.LEGAL_OPERATOR_EMAIL?.trim() || site.contacts.email,
  phone: site.contacts.phone,
  siteUrl: site.url,
};

// Документы публикуются (индексируются) только после юридической проверки.
export const legalReady =
  process.env.LEGAL_DOCUMENTS_APPROVED === "true" && Object.values(legalOperator).every(Boolean);
