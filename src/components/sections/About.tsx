import { about } from "@/content/home";
import { cn } from "@/lib/cn";
import { typo } from "@/lib/typography";

export function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="page-container pt-19.5 pb-15.5 lg:pt-28 lg:pb-25"
    >
      <div className="lg:grid lg:grid-cols-4 lg:gap-2.5">
        <h2
          id="about-title"
          className="font-display text-xl font-medium text-muted lg:text-[22px]"
        >
          О нас
        </h2>
        <p className="mt-4 text-justify text-[15px] leading-[1.15] lg:col-span-3 lg:mt-0 lg:text-[22px] lg:leading-[1.32]">
          <strong className="font-semibold">{about.lead}</strong>
          {typo(about.text)}
        </p>
      </div>

      <dl className="mt-11 grid grid-cols-2 lg:mt-17 lg:grid-cols-4 lg:gap-x-2.5">
        {about.stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              i < 2 && "border-b border-line pb-4 lg:border-b-0 lg:pb-0",
              i >= 2 && "pt-4 lg:pt-0",
            )}
          >
            <div
              className={cn(
                "flex h-full min-h-27.5 flex-col lg:min-h-30",
                i % 2 === 1 && "border-l border-line pl-5 lg:pl-5.5",
                i === 2 && "lg:border-l lg:border-line lg:pl-5.5",
              )}
            >
              <dt className="order-2 mt-3 text-[15px] leading-tight font-bold whitespace-pre-line lg:mt-3.5 lg:text-[17px]">
                {stat.label}
              </dt>
              <dd className="order-1 flex items-baseline text-[62px] leading-[0.9] font-normal tracking-tight lg:text-[80px]">
                {stat.prefix && <span className="text-[28px] lg:text-[30px]">{stat.prefix}</span>}
                {stat.value}
                {stat.suffix && <span className="text-[28px] lg:text-[30px]">{stat.suffix}</span>}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
