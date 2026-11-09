import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export function BlogHeader({ article = false }: { article?: boolean }) {
  return (
    <header className="blog-header">
      <Link href="/" aria-label="VentCore — на главную" className="blog-brand block border-b-2 border-blue pb-3">
        <Logo />
      </Link>
      {article ? (
        <Link href="/blog" className="mt-3 inline-flex items-center gap-2 font-display text-lg font-medium transition-colors hover:text-blue lg:text-2xl">
          <span aria-hidden="true">←</span> Блог VentCore
        </Link>
      ) : (
        <>
          <h1 className="mt-3 font-display text-2xl leading-none font-medium uppercase lg:text-[48px]">Блог</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-navy/75 lg:mt-5 lg:text-xl">
            Вентиляция и кондиционирование: как выбрать систему, спланировать монтаж и сохранить комфорт в квартире, доме или офисе.
          </p>
        </>
      )}
    </header>
  );
}
