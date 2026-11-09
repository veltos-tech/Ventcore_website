import type { ComponentType, CSSProperties, SVGProps } from "react";

import {
  BlueprintIcon,
  ClockCheckIcon,
  ThumbUpIcon,
  ToolsIcon,
  WarrantyIcon,
  WorkerIcon,
} from "@/components/icons/feature-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { advantages, type AdvantageIcon } from "@/content/home";
import { cn } from "@/lib/cn";
import { typo } from "@/lib/typography";

const icons: Record<AdvantageIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  worker: WorkerIcon,
  tools: ToolsIcon,
  warranty: WarrantyIcon,
  blueprint: BlueprintIcon,
  thumb: ThumbUpIcon,
  clock: ClockCheckIcon,
};

// Порядок плиток повторяет мобильный макет; на десктопе они расставляются
// по сетке 4×2 явными координатами.
type Tile =
  | { kind: "card"; index: number; place: string }
  | { kind: "flow"; tone: "navy" | "blue"; place: string };

const tiles: Tile[] = [
  { kind: "card", index: 0, place: "lg:col-start-1 lg:row-start-1" },
  { kind: "card", index: 1, place: "lg:col-start-1 lg:row-start-2" },
  { kind: "flow", tone: "navy", place: "lg:col-start-3 lg:row-start-1" },
  { kind: "card", index: 2, place: "lg:col-start-4 lg:row-start-1" },
  { kind: "card", index: 3, place: "lg:col-start-2 lg:row-start-1" },
  { kind: "flow", tone: "blue", place: "lg:col-start-2 lg:row-start-2" },
  { kind: "card", index: 4, place: "lg:col-start-3 lg:row-start-2" },
  { kind: "card", index: 5, place: "lg:col-start-4 lg:row-start-2" },
];

export function WhyUs() {
  return (
    <section id="why" aria-labelledby="why-title" className="page-container pt-19.5 lg:pt-30">
      <SectionHeader id="why-title" label={advantages.label} title={advantages.title} />

      <div className="mt-6 grid gap-2.5 md:grid-cols-2 lg:mt-9 lg:grid-cols-4">
        {tiles.map((tile) =>
          tile.kind === "card" ? (
            <AdvantageCard key={`card-${tile.index}`} index={tile.index} className={tile.place} />
          ) : (
            <FlowBars key={`flow-${tile.tone}`} tone={tile.tone} className={tile.place} />
          ),
        )}
      </div>
    </section>
  );
}

function AdvantageCard({ index, className }: { index: number; className?: string }) {
  const item = advantages.items[index];
  const Icon = icons[item.icon];

  return (
    <article
      className={cn(
        "flex min-h-69.25 flex-col rounded-card border border-muted p-4.25 transition-colors duration-300 hover:border-navy",
        className,
      )}
    >
      <Icon className="h-14 w-auto self-start text-navy" />
      <h3 className="mt-7 font-display text-2xl leading-tight font-bold lg:text-[22px]">
        {item.title}
      </h3>
      <p className="mt-2 text-base leading-snug lg:mt-1.5">{typo(item.text)}</p>
    </article>
  );
}

// Декоративные «потоки воздуха»: три полосы, крайние плавно перетекают по ширине.
function FlowBars({ tone, className }: { tone: "navy" | "blue"; className?: string }) {
  const color = tone === "navy" ? "bg-navy" : "bg-blue";
  // navy: узкая | гибкая | широкая; blue — зеркально. Ширины как в макете
  // (60 и 164px), но в узкой колонке (планшеты) сжимаются пропорционально.
  const narrow = { "--w": "min(60px, 18%)", "--w-to": "min(120px, 36%)" };
  const wide = { "--w": "min(164px, 45%)", "--w-to": "min(104px, 27%)" };
  const [first, last] = tone === "navy" ? [narrow, wide] : [wide, narrow];

  return (
    <div aria-hidden="true" className={cn("flex min-h-69.25 gap-1.5", className)}>
      <span
        className={cn("shrink-0 grow-0 basis-(--w) animate-flow rounded-card", color)}
        style={{ ...first, animationDelay: tone === "blue" ? "-3.5s" : "0s" } as CSSProperties}
      />
      <span className={cn("min-w-4 flex-1 rounded-card", color)} />
      <span
        className={cn("shrink-0 grow-0 basis-(--w) animate-flow rounded-card", color)}
        style={{ ...last, animationDelay: tone === "blue" ? "-3.5s" : "0s" } as CSSProperties}
      />
    </div>
  );
}
