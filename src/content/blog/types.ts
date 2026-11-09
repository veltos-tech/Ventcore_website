import type { StaticImageData } from "next/image";

export type BlogSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
};

export type BlogPost = {
  slug: string;
  title: string;
  cardTitle?: string;
  seoTitle: string;
  description: string;
  category: string;
  image: StaticImageData;
  imageAlt: string;
  illustration?: boolean;
  published: string;
  updated?: string;
  summary: string;
  sections: BlogSection[];
  questions: { question: string; answer: string }[];
  sources: { title: string; url: string }[];
  related: string[];
};
