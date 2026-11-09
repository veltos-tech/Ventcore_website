import { mainNav } from "@/content/site";

import { MobileMenu } from "./MobileMenu";

// Навигация поверх hero (по макету она не фиксированная).
export function SiteNav() {
  return (
    <div className="relative z-30 pt-3 lg:pt-[clamp(32px,4.6vw,66px)]">
      <MobileMenu />
      <nav aria-label="Основное меню" className="hidden lg:block">
        <ul className="flex gap-12.5 font-display text-[22px] leading-none font-medium text-navy">
          {mainNav.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="transition-colors hover:text-blue">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
