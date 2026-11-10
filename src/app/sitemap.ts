import type { MetadataRoute } from "next";

import { posts } from "@/content/blog";
import { legalReady } from "@/content/legal";
import { site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/objekty", "/blog", "/rekvizity"];
  // Пока документы не утверждены, страницы политики, соглашения и согласия закрыты тегом noindex.
  // Закрытые страницы в sitemap не указывают: поисковики считают это ошибкой («отправленный URL помечен noindex»).
  if (legalReady) pages.push("/privacy", "/terms", "/consent");
  return [
    ...pages.map((path) => ({ url: `${site.url}${path}` })),
    ...posts.map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      ...(post.updated ? { lastModified: new Date(post.updated) } : {}),
    })),
  ];
}
