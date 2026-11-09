import { MailIcon, PhoneIcon, TelegramIcon } from "@/components/icons/ui-icons";
import { emailHref, phoneHref, site } from "@/content/site";
import { cn } from "@/lib/cn";

// Иконка звонка показывается, только если в site.ts указан номер
const contactLinks = [
  { href: site.contacts.telegram, label: "Написать в Telegram", Icon: TelegramIcon, external: true },
  { href: emailHref, label: "Написать на почту", Icon: MailIcon },
  { href: phoneHref, label: "Позвонить", Icon: PhoneIcon },
].filter((link) => link.href);

// Ширина капсулы зависит от числа иконок (42px на иконку на телефоне, 56px на десктопе)
const widthClass = contactLinks.length === 3 ? "w-[126px] lg:w-[168px]" : "w-[84px] lg:w-[112px]";

// Стеклянная капсула с быстрыми контактами — в hero и в мобильном меню.
export function ContactPill({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "glass-material glass-material-contacts glass-material-dark grid h-[49px] rounded-[20px] px-1.5 text-white",
        contactLinks.length === 3 ? "grid-cols-3" : "grid-cols-2",
        widthClass,
        className,
      )}
    >
      {contactLinks.map(({ href, label, Icon, external }) => (
        <li key={label} className="flex min-w-0">
          <a
            href={href}
            aria-label={label}
            className="contact-link grid size-full place-items-center rounded-[20px]"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <Icon className="size-6" />
          </a>
        </li>
      ))}
    </ul>
  );
}
