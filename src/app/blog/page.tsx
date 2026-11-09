import type { Metadata } from "next";

import { BlogCard } from "@/components/blog/BlogCard";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { BlogMotif } from "@/components/blog/BlogMotif";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/ui/JsonLd";
import { blog, posts } from "@/content/blog";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: blog.title,
  description: blog.description,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website", url: "/blog", title: `${blog.title} — ${site.name}`, description: blog.description,
    images: [{ url: posts[0].image.src, width: posts[0].image.width, height: posts[0].image.height, alt: posts[0].imageAlt }],
  },
};

export default function BlogPage() {
  const structuredData = [
    {
      "@context": "https://schema.org", "@type": "CollectionPage",
      "@id": `${site.url}/blog#page`, url: `${site.url}/blog`, name: blog.title,
      description: blog.description, inLanguage: "ru-RU",
      mainEntity: {
        "@type": "ItemList", numberOfItems: posts.length,
        itemListElement: posts.map((post, index) => ({ "@type": "ListItem", position: index + 1, name: post.title, url: `${site.url}/blog/${post.slug}` })),
      },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: site.url },
        { "@type": "ListItem", position: 2, name: "Блог", item: `${site.url}/blog` },
      ],
    },
  ];

  return (
    <div className="min-h-svh bg-white text-navy">
      <JsonLd data={structuredData} />
      <main className="page-container">
        <BlogHeader />
        <div className="blog-feed">
          <BlogCard post={posts[0]} featured />
          <div className="blog-grid">
            <BlogCard post={posts[1]} />
            <BlogCard post={posts[2]} />
            <BlogMotif />
            <BlogCard post={posts[3]} spotlight />
            <BlogCard post={posts[4]} />
            <BlogCard post={posts[5]} />
            <BlogMotif blue />
            <BlogCard post={posts[6]} spotlight />
            {posts.slice(7).map((post) => <BlogCard post={post} key={post.slug} />)}
          </div>
        </div>
      </main>
      <Footer anchorBase="/" />
    </div>
  );
}
