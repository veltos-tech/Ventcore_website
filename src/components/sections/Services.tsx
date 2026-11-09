import Image from "next/image";

import { ButtonLink } from "@/components/ui/Button";
import { services, type Service } from "@/content/home";
import { typo } from "@/lib/typography";

// Строки сетки одной высоты (auto-rows-fr): если блок «Наши услуги» выше
// пропорции фото (планшеты), карточки тянутся вместе с ним, без пустых полос.
export function Services() {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="grid md:auto-rows-fr md:grid-cols-2 lg:grid-cols-3"
    >
      <div className="flex flex-col bg-navy px-5 pt-10 pb-11 text-white lg:px-12.5 lg:pt-10 lg:pb-9.5">
        <h2
          id="services-title"
          className="font-display text-2xl leading-tight font-extrabold xl:text-[32px]"
        >
          {services.title}
        </h2>
        <p className="mt-4 max-w-[355px] text-[15px] leading-snug lg:mt-3 xl:text-xl">
          {typo(services.text)}
        </p>
        <ButtonLink href="#order" className="mt-5 lg:mt-auto lg:max-w-[380px]">
          Заказать
        </ButtonLink>
      </div>

      {services.items.map((service) => (
        <ServiceCard key={service.slug} service={service} />
      ))}
    </section>
  );
}

// Карточка услуги: по умолчанию — фото и плашка с названием,
// при наведении — размытие фото и описание (как в макете у «Проектирования»).
function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="group relative isolate aspect-[480/268] size-full overflow-hidden bg-navy">
      <Image
        src={service.image}
        alt=""
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        className="-z-10 object-cover transition duration-500 ease-out-soft group-hover:scale-110 group-hover:blur-md"
      />

      <div className="absolute inset-0 -z-10 bg-navy/45 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="flex h-full translate-y-3 flex-col justify-center px-5 text-white opacity-0 transition duration-500 ease-out-soft group-hover:translate-y-0 group-hover:opacity-100 lg:px-12.5">
        <p aria-hidden="true" className="font-display text-xl font-extrabold xl:text-[28px]">
          {service.title}
        </p>
        <p className="mt-2 max-w-[360px] text-[15px] leading-snug lg:mt-4 xl:text-xl">
          {typo(service.description)}
        </p>
      </div>

      <h3
        className="glass-material glass-material-blue absolute inset-x-5 bottom-5 flex h-[46px] items-center justify-center rounded-[20px] font-display text-xl font-medium text-white transition-[opacity,transform] duration-500 ease-out-soft group-hover:translate-y-2 group-hover:opacity-0 lg:inset-x-12.5 lg:bottom-9.5"
      >
        {service.title}
      </h3>
    </article>
  );
}
