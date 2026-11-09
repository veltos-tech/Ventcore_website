import Link from "next/link";

import { Footer } from "@/components/layout/Footer";
import { Logo } from "@/components/ui/Logo";
import { legalOperator, legalReady } from "@/content/legal";

/** Строка — пункт с автонумерацией («1.1.»), массив строк — маркированный список */
export type LegalBlock = string | string[];
export type LegalSection = { title: string; blocks: LegalBlock[] };

const operatorRows = [
  ["Полное наименование", legalOperator.name],
  ["ИНН / КПП", `${legalOperator.inn} / ${legalOperator.kpp}`],
  ["ОГРН", legalOperator.ogrn],
  ["Адрес", legalOperator.address],
  ["Электронная почта", legalOperator.email],
  // Телефон добавляется, когда его укажут в src/content/site.ts
  ...(legalOperator.phone ? [["Телефон", legalOperator.phone] as const] : []),
] as const;

export function LegalPage({
  title,
  intro,
  sections,
  see,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
  /** Ссылки «См. также» в конце документа */
  see: { href: string; label: string }[];
}) {
  return (
    <div className="min-h-svh bg-white text-navy">
      <main className="page-container pt-9 lg:pt-16">
        <Link href="/" aria-label="VentCore — на главную" className="block w-full max-w-[760px] border-b-2 border-blue pb-3">
          <Logo />
        </Link>
        <Link href="/" className="mt-5 inline-block text-sm text-muted hover:text-blue lg:text-base">
          ← На главную
        </Link>

        <article className="max-w-4xl pb-10">
          <h1 className="mt-6 font-display text-[32px] leading-tight font-semibold lg:text-[52px]">{title}</h1>

          {!legalReady && (
            <p role="note" className="mt-6 rounded-card border border-line bg-navy/5 p-5 text-base leading-relaxed">
              Черновик: документ подготовлен по реквизитам оператора и ожидает юридической проверки перед публикацией.
            </p>
          )}

          <p className="mt-6 text-lg leading-relaxed">{intro}</p>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Сведения об операторе</h2>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {operatorRows.map(([label, value]) => (
                <div key={label} className="gap-4 py-3 sm:grid sm:grid-cols-[220px_1fr]">
                  <dt className="text-muted">{label}</dt>
                  <dd>
                    {label === "Электронная почта" ? (
                      <a className="text-blue underline-offset-2 hover:underline" href={`mailto:${value}`}>
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {sections.map((section, sectionIndex) => {
            let clause = 0;
            return (
              <section key={section.title} className="mt-10">
                <h2 className="font-display text-2xl font-semibold">
                  {sectionIndex + 1}. {section.title}
                </h2>
                {section.blocks.map((block) =>
                  typeof block === "string" ? (
                    <p key={block} className="mt-4 text-base leading-[1.75] lg:text-lg">
                      <span className="text-muted tabular-nums">
                        {sectionIndex + 1}.{++clause}.
                      </span>{" "}
                      {block}
                    </p>
                  ) : (
                    <ul key={block[0]} className="mt-3 list-disc space-y-2 pl-9 text-base leading-relaxed lg:text-lg">
                      {block.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            );
          })}

          <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
            См. также:{" "}
            {see.map((item, index) => (
              <span key={item.href}>
                {index > 0 && ", "}
                <Link className="text-blue underline-offset-2 hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </span>
            ))}
            .
          </p>
        </article>
      </main>
      <Footer anchorBase="/" />
    </div>
  );
}
