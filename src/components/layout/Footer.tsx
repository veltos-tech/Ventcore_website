import Link from "next/link";

import { TelegramIcon } from "@/components/icons/ui-icons";
import { LogoWithTagline } from "@/components/ui/Logo";
import { emailHref, legalNav, mainNav, phoneHref, site } from "@/content/site";
import { cn } from "@/lib/cn";
import { typo } from "@/lib/typography";

const linkClass = "text-black transition-colors hover:text-blue";

type FooterProps = {
  /** Белая карточка — для страниц с тёмным фоном (галерея) */
  onDark?: boolean;
  /** Префикс для якорей вида «#about»: на внутренних страницах — «/» (ведут на главную) */
  anchorBase?: string;
};

export function Footer({ onDark = false, anchorBase = "" }: FooterProps) {
  const year = new Date().getFullYear();
  const copyright = `© ${year} ${site.name}.`;
  const resolve = (href: string) => (href.startsWith("#") ? `${anchorBase}${href}` : href);

  return (
    <footer id="contacts" className="page-container pt-12.5 pb-12.5">
      <div
        className={cn(
          "rounded-card border border-muted p-5 lg:grid lg:grid-cols-4 lg:gap-x-2.5 lg:px-0 lg:pt-3 lg:pb-5",
          onDark && "bg-white text-navy",
        )}
      >
        <div className="lg:row-span-2 lg:flex lg:flex-col lg:justify-between lg:pl-12.5">
          <LogoWithTagline className="w-[260px] max-w-full text-[15px]" />
          <p className="hidden text-base leading-snug text-muted lg:block">
            {copyright}
            <br />
            Все права защищены.
          </p>
        </div>

        <p className="mt-5 text-sm leading-snug lg:col-span-3 lg:mt-5 lg:pr-12 lg:text-base">
          {typo(site.footerAbout)}
        </p>

        <nav aria-label="Документы" className="mt-8 lg:mt-10">
          <ul className="flex flex-col gap-2 text-[15px] leading-tight lg:gap-3 lg:text-lg">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={resolve(item.href)} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Разделы сайта" className="mt-8 lg:mt-10">
          <ul className="flex flex-col gap-3 text-[15px] leading-tight lg:gap-4 lg:text-lg">
            {mainNav.map((item) => (
              <li key={item.href}>
                <a href={resolve(item.href)} className={linkClass}>
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/blog" className={linkClass}>Блог</Link>
            </li>
          </ul>
        </nav>

        <address className="mt-10 flex flex-col gap-5 text-sm leading-snug not-italic lg:mt-10 lg:pr-7.5 lg:text-base">
          <p>
            {site.contacts.address.city},
            <br />
            {site.contacts.address.street}
          </p>
          {phoneHref && (
            <p>
              Телефон:
              <br />
              <a href={phoneHref} className="hover:text-blue">
                {site.contacts.phone}
              </a>
            </p>
          )}
          <p>
            Email:
            <br />
            <a href={emailHref} className="hover:text-blue">
              {site.contacts.email}
            </a>
          </p>
          <a
            href={site.contacts.telegramBlog}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-fit items-center gap-2.5 text-navy transition-colors hover:text-blue"
          >
            <TelegramIcon className="size-6 shrink-0 transition-transform duration-300 ease-spring group-hover:scale-110" />
            <span>Следите за нами в Telegram</span>
          </a>
        </address>

        <p className="mt-10 text-sm text-muted lg:hidden">
          {copyright} Все права защищены.
        </p>
      </div>
    </footer>
  );
}
