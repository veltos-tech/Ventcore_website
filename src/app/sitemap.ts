import type { MetadataRoute } from "next";

import { site } from "@/content/site";
import { posts } from "@/content/blog";

import { legalReady } from "@/content/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url },
    { url: `${site.url}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/consent`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/rekvizity`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/objekty` },
    { url: `${site.url}/blog` },
    ...(legalReady ? [{ url: `${site.url}/privacy` }, { url: `${site.url}/terms` }] : []),
    ...posts.map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      ...(post.updated ? { lastModified: new Date(post.updated) } : {}),
    })),
  ];
}
