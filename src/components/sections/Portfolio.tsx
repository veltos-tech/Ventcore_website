import Image from "next/image";
import Link from "next/link";

import { portfolioViewAll as moreImage } from "@/content/images";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { portfolio } from "@/content/home";

const sizes = "(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw";

export function Portfolio() {
  return (
    <section id="portfolio" aria-labelledby="portfolio-title" className="page-container pt-15 lg:pt-15">
      <SectionHeader id="portfolio-title" label={portfolio.label} title={portfolio.title} />

      <ul className="mt-6 grid gap-2.5 md:grid-cols-2 lg:mt-6 lg:grid-cols-4">
        {/* Любое фото ведёт в галерею работ */}
        {portfolio.items.map((item) => (
          <li key={item.alt}>
            <Link
              href={portfolio.more.href}
              className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-line/30"
            >
              <Image
                src={item.image}
                alt={item.alt}
                fill
                sizes={sizes}
                className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-105"
              />
              <span className="sr-only">— открыть галерею работ</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={portfolio.more.href}
            className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-navy"
          >
            {/* Стрелка уже есть на изображении из макета */}
            <Image
              src={moreImage}
              alt=""
              fill
              sizes={sizes}
              className="object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
            />
            <span className="sr-only">{portfolio.more.label}</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
