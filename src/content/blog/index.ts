import { apartment } from "./apartment";
import { commissioning } from "./commissioning";
import { conditioning } from "./conditioning";
import { cost } from "./cost";
import { design } from "./design";
import { ducted } from "./ducted";
import { filters } from "./filters";
import { house } from "./house";
import { installation } from "./installation";
import { noise } from "./noise";
import { office } from "./office";
import { service } from "./service";
import type { BlogPost } from "./types";

export const blog = {
  title: "Блог о вентиляции и кондиционировании",
  description: "Статьи VentCore о вентиляции и кондиционировании в Москве: выбор системы для квартиры, дома и офиса, проектирование, монтаж, стоимость и обслуживание.",
};

export const posts: BlogPost[] = [apartment, design, conditioning, service, installation, house, office, ducted, cost, noise, filters, commissioning];

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}

export function articleWordCount(post: BlogPost) {
  const text = [post.title, post.summary, ...post.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? []), ...(s.table?.rows.flat() ?? [])]), ...post.questions.flatMap((q) => [q.question, q.answer])].join(" ");
  return text.trim().split(/\s+/u).length;
}

export function readingMinutes(post: BlogPost) {
  return Math.max(1, Math.ceil(articleWordCount(post) / 180));
}
