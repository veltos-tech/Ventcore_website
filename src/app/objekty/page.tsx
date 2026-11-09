import type { Metadata } from "next";
import Link from "next/link";

import { WorkCard } from "@/components/gallery/WorkCard";
import { ArrowLeftIcon } from "@/components/icons/ui-icons";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/ui/JsonLd";
import { gallery } from "@/content/gallery";
import { site } from "@/content/site";
import { typo } from "@/lib/typography";

export const metadata: Metadata = {
  title: gallery.seoTitle,
  description: gallery.description,
  alternates: { canonical: "/objekty" },
  openGraph: { url: "/objekty", title: `${gallery.seoTitle} — ${site.name}`, description: gallery.description },
};

const breadcrumbs = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Главная", item: site.url },
    { "@type": "ListItem", position: 2, name: gallery.label, item: `${site.url}/objekty` },
  ],
};

export default function GalleryPage() {
  return (
    <div className="min-h-svh bg-navy text-white">
      <JsonLd data={breadcrumbs} />
      <main className="page-container pt-9 lg:pt-9">
        <Link
          href="/#portfolio"
          className="inline-flex items-center gap-2.5 font-display text-xl font-medium text-muted transition-colors hover:text-white lg:gap-2"
        >
          <ArrowLeftIcon className="size-5 lg:size-[22px]" />
          {gallery.back}
        </Link>

        <h1 className="mt-2 font-display text-[32px] leading-[1.12] font-semibold lg:mt-3 lg:text-[64px] lg:leading-[1.15]">
          {gallery.title}
        </h1>

        <div className="mt-9 lg:mt-12 lg:grid lg:grid-cols-4 lg:gap-x-2.5">
          <p className="font-display text-xl font-medium text-muted lg:text-[22px]">{gallery.label}</p>
          <p className="mt-3.5 text-[15px] leading-[1.15] lg:col-span-3 lg:text-justify lg:mt-0 lg:text-[22px] lg:leading-[1.32]">
            {typo(gallery.intro)}
          </p>
        </div>

        <ul aria-label="Фотографии и описание работ" className="mt-4 grid gap-2.5 md:grid-cols-2 lg:mt-9">
          {gallery.works.map((work) => (
            <li key={work.id}>
              <WorkCard work={work} />
            </li>
          ))}
        </ul>

      </main>

      <Footer onDark anchorBase="/" />
    </div>
  );
}
