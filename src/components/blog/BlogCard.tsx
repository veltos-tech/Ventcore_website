import Image from "next/image";
import Link from "next/link";

import type { BlogPost } from "@/content/blog/types";
import { typo } from "@/lib/typography";

export function publicationDate(date: string, year = false) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "Europe/Moscow" }).format(new Date(date));
}

export function BlogCard({ post, featured = false, spotlight = false }: { post: BlogPost; featured?: boolean; spotlight?: boolean }) {
  return (
    <article className={`blog-card${featured ? " blog-card-featured" : ""}${spotlight ? " blog-card-spotlight" : ""}`}>
      <Link href={`/blog/${post.slug}`} className="blog-card-link group">
        <div className="blog-card-photo relative overflow-hidden bg-navy/5">
          <Image src={post.image} alt={post.imageAlt} fill sizes={featured ? "(min-width: 1440px) 665px, (min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 320px, 50vw"} loading={featured ? "eager" : "lazy"} className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.035]" />
          <time dateTime={post.published} className="absolute top-0 left-0 bg-navy px-1.5 py-0.5 text-xs leading-tight font-medium text-white lg:text-lg">
            {publicationDate(post.published)}
          </time>
        </div>
        <div className="blog-card-text">
          <h2 className="font-display font-bold transition-colors group-hover:text-blue">{post.cardTitle ?? post.title}</h2>
          {featured && <p className="mt-3 text-[15px] leading-snug text-navy/80 lg:text-[22px]">{typo(post.description)}</p>}
          <span className="blog-card-read mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue lg:text-base">
            Читать статью <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
