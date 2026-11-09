import type { StaticImageData } from "next/image";

import daikin from "@/assets/images/brands/daikin.png";
import generalClimate from "@/assets/images/brands/general-climate.png";
import haier from "@/assets/images/brands/haier.png";
import hisense from "@/assets/images/brands/hisense.png";
import kentatsu from "@/assets/images/brands/kentatsu.png";
import mdv from "@/assets/images/brands/mdv.png";
import midea from "@/assets/images/brands/midea.png";
import samsung from "@/assets/images/brands/samsung.png";

import { serviceAirConditioning as kondicionirovanie } from "@/content/images";
import { serviceInstallation as montazh } from "@/content/images";
import { serviceDesign as proektirovanie } from "@/content/images";
import { serviceMaintenance as servis } from "@/content/images";
import { serviceVentilation as ventilyaciya } from "@/content/images";
import { portfolioSlotDiffuser as work1 } from "@/content/images";
import { portfolioAccessPanel as work2 } from "@/content/images";
import { portfolioFlexibleDucts as work3 } from "@/content/images";

// Контент главной страницы. Структура данных повторяет будущие коллекции CMS.

export const hero = {
  lead: "Проектирование, поставка, монтаж и сервис",
  cta: "Заказать",
};

export const about = {
  // Первое слово выделяется жирным в вёрстке
  lead: "VentCore",
  text: " - инженерная компания полного цикла, создающая системы микроклимата для жилых, коммерческих и общественных пространств. С 2019 года мы объединяем проектирование, подбор оборудования, монтаж, автоматизацию и сервис в одной команде. Работаем с квартирами, частными домами, офисами, ресторанами и производственными объектами по всей России, обеспечивая точность решений, прозрачность процессов и безупречный результат.",
  stats: [
    { value: "700", suffix: "+", label: "реализованных объектов" },
    { value: "7", prefix: "+", label: "лет на рынке" },
    { value: "2", label: "года гарантии" },
    { value: "80", suffix: "%", label: "клиентов приходят\nпо рекомендации" },
  ],
};

export type Service = {
  slug: string;
  title: string;
  description: string;
  image: StaticImageData;
};

export const services = {
  title: "Наши услуги",
  text: "Полный цикл работ по системам вентиляции и кондиционирования - от проекта до сервиса.",
  items: [
    {
      slug: "proektirovanie",
      title: "Проектирование",
      description: "Полное проектирование от А до Я. Полное сопровождение работы до его завершения",
      image: proektirovanie,
    },
    {
      slug: "ventilyaciya",
      title: "Вентиляция",
      description: "Приток, вытяжка, рекуперация тепла, канальные системы.",
      image: ventilyaciya,
    },
    {
      slug: "montazh",
      title: "Монтаж",
      description: "Воздуховоды, фреоновые трассы, изоляция, автоматика, пусконаладка.",
      image: montazh,
    },
    {
      slug: "kondicionirovanie",
      title: "Кондиционирование",
      description: "От настенных сплит-систем до VRF/VRV и центральных установок.",
      image: kondicionirovanie,
    },
    {
      slug: "servis",
      title: "Сервис и ТО",
      description: "Диагностика, чистка, замена фильтров, устранение неисправностей.",
      image: servis,
    },
  ] satisfies Service[],
};

export type AdvantageIcon = "worker" | "tools" | "warranty" | "blueprint" | "thumb" | "clock";

export const advantages = {
  label: "Почему мы",
  title: "Почему VentCore?",
  items: [
    {
      icon: "worker",
      title: "Единая ответственность",
      text: "Один подрядчик на всех этапах - от первого выезда и проекта до монтажа и сервиса. Отвечаем за результат целиком.",
    },
    {
      icon: "tools",
      title: "Официальные поставки",
      text: "Оборудование от официальных поставщиков и производителей. Документы, серийные номера и заводская гарантия на каждую поставку.",
    },
    {
      icon: "warranty",
      title: "Гарантия 2 года",
      text: "Гарантия на монтажные работы и оборудование. После запуска системы остаёмся на связи и обеспечиваем сервисное сопровождение.",
    },
    {
      icon: "blueprint",
      title: "Проектирование",
      text: "Сначала рассчитываем и проектируем - затем монтируем. Это позволяет заранее учесть технические нюансы и избежать дорогостоящих переделок.",
    },
    {
      icon: "thumb",
      title: "Прозрачная смета",
      text: "Фиксируем состав работ и оборудования до начала монтажа. Вы заранее понимаете бюджет и за что платите.",
    },
    {
      icon: "clock",
      title: "Соблюдение сроков",
      text: "Фиксируем сроки выполнения работ документально. Планируем этапы заранее и несём ответственность за соблюдение договоренностей.",
    },
  ] satisfies { icon: AdvantageIcon; title: string; text: string }[],
};

export const process = {
  label: "Как мы работаем",
  steps: [
    { title: "Заявка", text: "Оставляете заявку на сайте или звоните." },
    { title: "Выезд инженера", text: "Приезжаем на объект, замеряем, оцениваем условия. Бесплатно в пределах МКАД." },
    { title: "Расчёт", text: "Готовим смету и варианты решения. Срок - 1 рабочий день." },
    { title: "Проект", text: "Разрабатываем рабочую документацию с расчётами и схемами." },
    { title: "Поставка", text: "Завозим оборудование на объект. Всё официальное, с гарантией." },
    { title: "Монтаж", text: "Собственная бригада выполняет монтаж по проекту." },
    { title: "Пусконаладка", text: "Запускаем систему, настраиваем, проверяем параметры." },
    { title: "Сервис", text: "Обслуживаем систему после сдачи. По договору или разово." },
  ],
};

export const portfolio = {
  label: "Портфолио",
  title: "Наши работы",
  items: [
    { image: work1, alt: "Скрытая вентиляция: щелевой диффузор в потолке квартиры" },
    { image: work2, alt: "Ревизионный люк с узлом вентиляционной системы в потолке" },
    { image: work3, alt: "Монтаж гибких воздуховодов и линейного диффузора" },
  ],
  more: { label: "Смотреть всю галерею работ", href: "/objekty" },
};

// TODO: сканы сертификатов для модального окна
const certificateBrands: { brand: string; logo: StaticImageData }[] = [
  { brand: "Daikin", logo: daikin },
  { brand: "Samsung", logo: samsung },
  { brand: "Haier", logo: haier },
  { brand: "Hisense", logo: hisense },
  { brand: "Midea", logo: midea },
  { brand: "Kentatsu", logo: kentatsu },
  { brand: "General Climate", logo: generalClimate },
  { brand: "MDV", logo: mdv },
];

export const certificates = {
  label: "Сертификаты",
  title: "Сертификаты и лицензии",
  company: "ООО «КОРГРУПП»",
  // Формулировка — как в сертификате Samsung: «является официальным дилером
  // оборудования … на территории Российской Федерации». Разбита на части для
  // оформления. TODO: сверить статус (дилер или дистрибьютор) по сертификату
  // каждого бренда
  statement: {
    verb: "является",
    role: "официальным дилером",
    object: "оборудования",
    territory: "на территории Российской Федерации.",
  },
  city: "г. Москва",
  items: certificateBrands.map((item, i) => ({ id: i + 1, ...item })),
};

// TODO: ответы на вопросы 3–7 — черновики по текстам ТЗ, согласовать с заказчиком
export const faq = {
  label: "FAQ",
  title: "Частые вопросы",
  items: [
    {
      q: "Когда лучше проектировать вентиляцию и кондиционирование?",
      a: "На этапе проектирования инженерных систем - то есть до начала отделочных работ. Так можно заложить воздуховоды и коммуникации в стены и потолок.",
    },
    {
      q: "Можно ли установить систему, если ремонт уже закончен?",
      a: "Да. Подбираем решение с минимальным вмешательством в готовую отделку и заранее согласовываем все видимые элементы.",
    },
    {
      q: "Можно ли скрыть оборудование в интерьере?",
      a: "Да. Воздуховоды и внутренние блоки прячем за подвесным потолком, в коробах и нишах, а решётки и диффузоры подбираем под интерьер. Все видимые элементы согласовываем на этапе проекта.",
    },
    {
      q: "Насколько шумно работает система?",
      a: "Уровень шума закладываем ещё в проекте: подбираем оборудование с запасом по производительности, используем шумоглушители и шумоизоляцию воздуховодов.",
    },
    {
      q: "Сколько стоит система под ключ?",
      a: "Стоимость зависит от площади, типа системы и оборудования. После выезда инженера готовим смету с вариантами решения - состав работ и цена фиксируются до начала монтажа.",
    },
    {
      q: "Нужно ли мне самому разбираться с оборудованием?",
      a: "Нет. Инженер подберёт оборудование под объект и бюджет, объяснит разницу между вариантами, а после запуска покажет, как пользоваться системой.",
    },
    {
      q: "Что будет, если после проекта изменится дизайн или планировка?",
      a: "Внесём изменения в проект и пересчитаем систему под новую планировку. Чем раньше сообщите об изменениях, тем проще их учесть.",
    },
  ],
};

export const lead = {
  title: "Получите расчёт системы микроклимата",
  text: "Оставьте контакты - инженер VentCore свяжется с вами, уточнит параметры объекта и подготовит персональное решение.",
  consent: "Соглашаетесь с политикой конфиденциальности",
  submit: "Заказать",
};
