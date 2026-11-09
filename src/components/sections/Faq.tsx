import { MinusIcon, PlusIcon } from "@/components/icons/ui-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { faq } from "@/content/home";
import { typo } from "@/lib/typography";

// Аккордеон на нативных <details name>: открыт только один вопрос, работает без JS.
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="page-container pt-15 lg:pt-33">
      <SectionHeader id="faq-title" label={faq.label} title={faq.title} />

      <div className="mt-6 border-b border-line lg:mt-9">
        {faq.items.map((item, i) => (
          <details key={item.q} name="faq" open={i === 0} className="faq-item group border-t border-line">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-4 font-display text-2xl leading-tight font-semibold transition-colors hover:text-blue lg:py-4.5 lg:text-[28px] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="relative mt-1 hidden size-6 shrink-0 lg:block">
                <PlusIcon className="absolute inset-0 transition-opacity group-open:opacity-0" />
                <MinusIcon className="absolute inset-0 opacity-0 transition-opacity group-open:opacity-100" />
              </span>
            </summary>
            <p className="max-w-[1280px] pb-5 text-base leading-snug lg:-mt-1 lg:text-xl lg:leading-[1.4]">
              {typo(item.a)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
