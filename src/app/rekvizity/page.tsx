import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons/ui-icons";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/ui/JsonLd";
import { requisites } from "@/content/requisites";
import { emailHref, phoneHref, site } from "@/content/site";
import { typo } from "@/lib/typography";

export const metadata: Metadata = {
  title: requisites.title,
  description: requisites.description,
  alternates: { canonical: requisites.slug },
  openGraph: { url: requisites.slug, title: `${requisites.title} — ${site.name}`, description: requisites.description },
};

const data = Object.fromEntries(requisites.rows.map((row) => [row.label, row.value]));

// Организация и хлебные крошки для поисковых систем
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    legalName: data["Полное наименование"],
    taxID: data["ИНН"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "наб. Пресненская, д. 8, стр. 1, помещ. 494М",
      addressLocality: "Москва",
      postalCode: site.contacts.address.postalCode,
      addressCountry: "RU",
    },
    ...(phoneHref ? { telephone: site.contacts.phone } : {}),
    email: site.contacts.email,
    url: site.url,
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: site.url },
      { "@type": "ListItem", position: 2, name: requisites.title, item: `${site.url}${requisites.slug}` },
    ],
  },
];

export default function RequisitesPage() {
  return (
    <>
      <JsonLd data={structuredData} />
      <main className="page-container pt-9">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-display text-xl font-medium text-muted transition-colors hover:text-navy lg:gap-2"
        >
          <ArrowLeftIcon className="size-5 lg:size-[22px]" />
          На главную
        </Link>

        <h1 className="mt-2 font-display text-[32px] leading-[1.12] font-semibold lg:mt-3 lg:text-[64px] lg:leading-[1.15]">
          {requisites.title}
        </h1>

        <p className="mt-4 max-w-[620px] text-[15px] leading-snug text-navy/80 lg:mt-6 lg:text-[22px] lg:leading-[1.32]">
          {typo(requisites.intro)}
        </p>

        <dl className="mt-9 border-t border-line lg:mt-14">
          {requisites.rows.map((row) => (
            <div
              key={row.label}
              className="border-b border-line py-4 lg:grid lg:grid-cols-4 lg:gap-x-2.5 lg:py-5"
            >
              <dt className="font-display text-base font-medium text-muted lg:text-[22px]">{row.label}</dt>
              <dd className="mt-1 text-[19px] leading-snug lg:col-span-3 lg:mt-0 lg:text-[22px]">
                <span className={row.copy ? "tabular-nums" : undefined}>{row.value}</span>
                {row.note && <span className="ml-3 text-muted">{row.note}</span>}
              </dd>
            </div>
          ))}

          <div className="border-b border-line py-4 lg:grid lg:grid-cols-4 lg:gap-x-2.5 lg:py-5">
            <dt className="font-display text-base font-medium text-muted lg:text-[22px]">Контакты</dt>
            <dd className="mt-1 flex flex-col gap-1 text-[19px] leading-snug lg:col-span-3 lg:mt-0 lg:text-[22px]">
              {phoneHref && (
                <a href={phoneHref} className="w-fit transition-colors hover:text-blue">
                  {site.contacts.phone}
                </a>
              )}
              <a href={emailHref} className="w-fit transition-colors hover:text-blue">
                {site.contacts.email}
              </a>
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm leading-snug text-muted lg:mt-8 lg:text-base">
          {requisites.privacyNote}{" "}
          <Link href={requisites.privacyHref} className="text-navy underline-offset-2 hover:underline">
            {requisites.privacyLabel}
          </Link>
          .
        </p>
      </main>

      <Footer anchorBase="/" />
    </>
  );
}
