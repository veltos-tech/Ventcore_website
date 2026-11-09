import Image from "next/image";

import { contactBuildings as towers } from "@/content/images";
import { lead } from "@/content/home";
import { typo } from "@/lib/typography";

import { LeadForm } from "./LeadForm";

export function LeadSection() {
  return (
    <section
      id="order"
      aria-labelledby="order-title"
      className="relative isolate mt-20 overflow-x-clip bg-navy lg:mt-56"
    >
      {/* Высота картинки привязана к высоте секции, а не к ширине экрана: башни
          выступают над секцией ровно на 145px (как в макете) и на широких
          мониторах не наезжают на FAQ. Края растворяются в фоне. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[calc(100%+24px)] -translate-x-1/2 lg:h-[calc(100%+145px)]"
      >
        <Image
          src={towers}
          alt=""
          sizes="(min-width: 1024px) 1600px, 1200px"
          className="h-full w-auto max-w-none [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]"
        />
      </div>

      <div className="page-container py-5 lg:pb-9">
        <div
          className="glass-material glass-material-form glass-material-dark w-full rounded-[20px] px-2.5 pt-2.5 pb-[26px] lg:w-[459px] lg:px-5 lg:pt-5 lg:pb-3.5"
        >
          <div className="pt-4 lg:pt-1.5">
            <h2
              id="order-title"
              className="font-display text-2xl leading-tight font-extrabold text-white lg:text-[22px]"
            >
              {lead.title}
            </h2>
            <p className="mt-3 text-lg leading-[22.5px] text-white lg:text-[22px] lg:leading-[1.32]">
              {typo(lead.text)}
            </p>
          </div>
          <LeadForm />
        </div>
      </div>
    </section>
  );
}
