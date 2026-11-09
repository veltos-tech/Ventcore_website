import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogCard, publicationDate } from "@/components/blog/BlogCard";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/ui/JsonLd";
import { articleWordCount, getPost, posts, readingMinutes } from "@/content/blog";
import { site } from "@/content/site";
import { typo } from "@/lib/typography";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  return {
    title: post.seoTitle, description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article", url: `/blog/${post.slug}`, title: `${post.seoTitle} — ${site.name}`,
      description: post.description, publishedTime: post.published, ...(post.updated ? { modifiedTime: post.updated } : {}),
      authors: [site.url], section: post.category,
      images: [{ url: post.image.src, width: post.image.width, height: post.image.height, alt: post.imageAlt }],
    },
    twitter: { card: "summary_large_image", title: post.seoTitle, description: post.description, images: [post.image.src] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const related = post.related.flatMap((item) => {
    const result = getPost(item);
    return result ? [result] : [];
  });
  const url = `${site.url}/blog/${post.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org", "@type": "BlogPosting", "@id": `${url}#article`,
      headline: post.title, description: post.description, mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url, image: new URL(post.image.src, site.url).href, inLanguage: "ru-RU", articleSection: post.category,
      datePublished: post.published, ...(post.updated ? { dateModified: post.updated } : {}), wordCount: articleWordCount(post),
      author: { "@type": "Organization", name: site.name, url: site.url },
      publisher: { "@type": "Organization", name: site.name, url: site.url, logo: { "@type": "ImageObject", url: `${site.url}/icon.svg` } },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: site.url },
        { "@type": "ListItem", position: 2, name: "Блог", item: `${site.url}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <div className="min-h-svh bg-white text-navy">
      <JsonLd data={structuredData} />
      <main className="page-container">
        <BlogHeader article />
        <article className="blog-article">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-navy/65 lg:text-base">
            <span className="font-medium text-blue">{post.category}</span>
            <time dateTime={post.published}>{publicationDate(post.published, true)}</time>
            <span>{readingMinutes(post)} мин чтения</span>
          </div>
          <h1 className="mt-5 max-w-6xl font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] lg:text-[60px]">
            {typo(post.title)}
          </h1>
          <p className="mt-5 max-w-4xl text-lg leading-relaxed text-navy/80 lg:mt-7 lg:text-2xl">{typo(post.description)}</p>
          <p className="mt-5 text-sm text-muted">Редакция <Link href="/#about" className="underline underline-offset-4 hover:text-blue">VentCore</Link></p>
          <figure className="mt-8 lg:mt-10">
            <div className="relative aspect-[3/2] overflow-hidden bg-navy/5 lg:aspect-[2.2/1]">
              <Image src={post.image} alt={post.imageAlt} fill loading="eager" sizes="(min-width: 1440px) 1340px, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-2 text-xs text-muted lg:text-sm">
              {post.illustration ? "Иллюстрация к материалу, созданная с помощью ИИ." : "Фотография инженерных работ из галереи VentCore."}
            </figcaption>
          </figure>

          <div className="blog-reading-layout mt-10 lg:mt-16">
            <nav aria-label="Содержание статьи" className="blog-toc">
              <p className="font-display text-lg font-semibold">В этой статье</p>
              <ol className="mt-4 flex flex-col gap-3 text-sm leading-snug lg:text-base">
                {post.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="transition-colors hover:text-blue">{section.title}</a></li>)}
                <li><a href="#questions" className="hover:text-blue">Частые вопросы</a></li>
              </ol>
            </nav>
            <div className="blog-article-body min-w-0">
              <p className="blog-answer border-l-2 border-blue pl-5 text-lg leading-relaxed font-medium lg:pl-7 lg:text-[23px]">{typo(post.summary)}</p>
              {post.sections.map((section) => (
                <section key={section.id} aria-labelledby={section.id} className="mt-10 lg:mt-14">
                  <h2 id={section.id} className="scroll-mt-8 font-display text-[26px] leading-tight font-semibold lg:text-[34px]">{typo(section.title)}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 text-base leading-[1.7] lg:text-[19px]">{typo(paragraph)}</p>)}
                  {section.bullets && <ul className="mt-5 list-disc space-y-3 pl-5 text-base leading-[1.65] marker:text-blue lg:text-[19px]">{section.bullets.map((item) => <li key={item}>{typo(item)}</li>)}</ul>}
                  {section.table && (
                    <div className="mt-6 overflow-x-auto overscroll-x-contain rounded-sm border border-line/60" tabIndex={0} role="region" aria-label={`Таблица: ${section.title}`}>
                      <table className="w-full min-w-[360px] border-collapse text-left text-sm leading-relaxed lg:text-base">
                        <caption className="sr-only">{section.title}</caption>
                        <thead className="bg-navy text-white"><tr>{section.table.headers.map((header) => <th key={header} scope="col" className="p-4 font-medium">{header}</th>)}</tr></thead>
                        <tbody>{section.table.rows.map((row) => <tr key={row[0]} className="border-t border-line/50">{row.map((cell, index) => index === 0 ? <th key={index} scope="row" className="w-[38%] p-4 align-top font-medium">{typo(cell)}</th> : <td key={index} className="p-4 align-top">{typo(cell)}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}

              <section aria-labelledby="questions" className="mt-12 lg:mt-16">
                <h2 id="questions" className="scroll-mt-8 font-display text-[28px] font-semibold lg:text-[34px]">Частые вопросы</h2>
                <dl className="mt-4">{post.questions.map((item) => <div key={item.question} className="border-t border-line/70 py-5"><dt className="font-display text-lg leading-snug font-semibold lg:text-[22px]">{typo(item.question)}</dt><dd className="mt-3 text-base leading-[1.65] lg:text-[19px]">{typo(item.answer)}</dd></div>)}</dl>
              </section>
              <div className="mt-9 border-t border-line/70 pt-6 text-base leading-relaxed lg:text-lg">
                <p>VentCore занимается проектированием, монтажом и сервисом вентиляции и кондиционирования в Москве и Московской области.</p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 font-medium text-blue">
                  <Link href="/#services" className="underline underline-offset-4">Услуги VentCore</Link>
                  <Link href="/objekty" className="underline underline-offset-4">Фотографии работ</Link>
                  <Link href="/#order" className="underline underline-offset-4">Обсудить задачу</Link>
                </div>
              </div>
            </div>
          </div>
        </article>
        <section aria-labelledby="related-posts" className="mt-16 border-t border-line pt-7 lg:mt-24 lg:pt-10">
          <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="related-posts" className="font-display text-[28px] font-semibold lg:text-[38px]">По теме</h2><Link href="/blog" className="text-blue hover:underline">Все статьи ↗</Link></div>
          <div className="blog-related mt-6">{related.map((item) => <BlogCard key={item.slug} post={item} />)}</div>
        </section>
      </main>
      <Footer anchorBase="/" />
    </div>
  );
}
