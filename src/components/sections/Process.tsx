import { SectionHeader } from "@/components/ui/SectionHeader";
import { process } from "@/content/home";
import { typo } from "@/lib/typography";

// Этапы складываются в стопку при прокрутке: каждая строка «прилипает»
// чуть ниже предыдущей (шаг --stack-step), оставляя видимой её верхнюю часть.
export function Process() {
  return (
    <section id="process" aria-labelledby="process-title" className="page-container pt-19.5 lg:pt-30">
      <SectionHeader id="process-title" label={process.label} />

      <ol className="mt-10 [--stack-step:32px] [--stack-top:16px] lg:mt-9 lg:[--stack-step:40px] lg:[--stack-top:40px]">
        {process.steps.map((step, i) => (
          <li
            key={step.title}
            className="sticky border-t border-line bg-white pt-2 pb-4 lg:grid lg:min-h-[157px] lg:grid-cols-4 lg:gap-x-2.5 lg:pt-1 lg:pb-8"
            style={{ top: `calc(var(--stack-top) + ${i} * var(--stack-step))` }}
          >
            <div className="flex items-baseline justify-between gap-4 font-display text-[32px] leading-tight lg:col-span-2 lg:justify-start lg:gap-0 lg:text-5xl">
              <span aria-hidden="true" className="shrink-0 font-bold tabular-nums lg:w-36">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-right font-bold lg:text-left">{step.title}</h3>
            </div>
            <p className="mt-3 max-w-[46ch] text-sm leading-tight lg:col-span-2 lg:mt-0 lg:max-w-none lg:pt-6 lg:pr-6 lg:text-[22px] lg:leading-[1.32]">
              {typo(step.text)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
