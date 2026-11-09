// Общие данные компании: используются в шапке, подвале, форме и SEO-разметке.
// Значения с пометкой TODO — плейсхолдеры, требуют подтверждения заказчика.

export const site = {
  name: "VentCore",
  tagline: "Ventilation & Air Conditioning",
  url: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://vent-core.com").replace(/\/+$/, ""),
  title: "VentCore — вентиляция и кондиционирование под ключ в Москве",
  description:
    "Инженерная компания полного цикла: проектирование, поставка, монтаж и сервис систем вентиляции и кондиционирования для квартир, домов, офисов и коммерческих объектов. Москва, МО и регионы России.",
  footerAbout:
    "Инженерная компания полного цикла. Проектирование, поставка, монтаж и сервис систем вентиляции и кондиционирования. Москва, МО и регионы России.",
  foundedYear: 2019,
  contacts: {
    // Пустая строка — номер нигде не показывается (иконка звонка, подвал, меню, реквизиты).
    // TODO: вписать реальный номер — он появится на сайте сам.
    phone: "" as string,
    email: "coregroup@bk.ru",
    telegram: "https://t.me/coreegroup",
    // Блог компании в Telegram — иконка в подвале
    telegramBlog: "https://t.me/ventcoreblog",
    address: {
      city: "г. Москва",
      street: "Пресненская набережная, д.8, стр.1, помещение 494М",
      postalCode: "123112",
    },
  },
} as const;

export const phoneHref = site.contacts.phone ? `tel:${site.contacts.phone.replace(/[^\d+]/g, "")}` : "";
export const emailHref = `mailto:${site.contacts.email}`;

export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "О нас", href: "#about" },
  { label: "Услуги", href: "#services" },
  { label: "Почему мы", href: "#why" },
  { label: "Этапы", href: "#process" },
  { label: "Заказать", href: "#order" },
  { label: "Контакты", href: "#contacts" },
];

export const legalNav: NavItem[] = [
  { label: "Политика конфиденциальности", href: "/privacy" },
  { label: "Пользовательское соглашение", href: "/terms" },
  { label: "Сертификаты", href: "#certificates" },
  { label: "Согласие на обработку данных", href: "/consent" },
  { label: "Реквизиты компании", href: "/rekvizity" },
];
