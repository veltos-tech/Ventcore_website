import { getImageProps } from "next/image";

import { heroBackground as heroBg } from "@/content/images";
import { heroBuildings as heroBuilding } from "@/content/images";
import { heroMobile as heroMobile } from "@/content/images";
import { SiteNav } from "@/components/layout/SiteNav";
import { ButtonLink } from "@/components/ui/Button";
import { ContactPill } from "@/components/ui/ContactPill";
import { Logo } from "@/components/ui/Logo";
import { hero } from "@/content/home";
import { cn } from "@/lib/cn";

// Art direction: до 768px — вертикальный мобильный кадр, шире — десктопный фон
// и поверх логотипа здание без фона (оно перекрывает низ букв).
// Фон и здание лежат в одинаковых контейнерах с одинаковым object-position,
// поэтому всегда совпадают.
const DESKTOP_MEDIA = "(min-width: 768px)";
const EMPTY_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const layerClass = "absolute inset-0 md:-top-35 lg:top-0";
const imageClass = "size-full object-cover object-top md:object-[38%_top] lg:object-top";

function heroImages() {
  const common = { alt: "", sizes: "100vw", quality: 85 };
  const {
    props: { srcSet: background },
  } = getImageProps({ ...common, src: heroBg });
  const {
    props: { srcSet: backgroundMobile, ...backgroundImg },
  } = getImageProps({ ...common, src: heroMobile });
  const {
    props: { srcSet: building, ...buildingImg },
  } = getImageProps({ ...common, src: heroBuilding });

  return { background, backgroundMobile, backgroundImg, building, buildingImg };
}

export function Hero() {
  const images = heroImages();

  return (
    <header className="relative isolate h-[clamp(560px,170.65vw,100svh)] overflow-hidden bg-sky md:h-[clamp(600px,100svh,820px)] lg:h-[clamp(640px,59.6vw,1000px)]">
      <div className={cn(layerClass, "-z-10")}>
        <picture>
          <source media={DESKTOP_MEDIA} srcSet={images.background} sizes="100vw" />
          {/* art direction через getImageProps */}
          <img
            {...images.backgroundImg}
            srcSet={images.backgroundMobile}
            alt=""
            loading="eager"
            fetchPriority="high"
            className={imageClass}
          />
        </picture>
      </div>

      <div className="page-container">
        <SiteNav />
        <h1 className="relative z-10 mt-2 lg:mt-[clamp(20px,2.6vw,37px)]">
          <span className="sr-only">
            VentCore — проектирование, поставка, монтаж и сервис систем вентиляции и
            кондиционирования
          </span>
          <Logo aria-hidden="true" />
        </h1>
      </div>

      <div className={cn(layerClass, "pointer-events-none z-20 hidden md:block")}>
        <picture>
          <source media={DESKTOP_MEDIA} srcSet={images.building} sizes="100vw" />
          {/* на мобильных источник не подходит — грузится пустой пиксель */}
          <img {...images.buildingImg} src={EMPTY_PIXEL} alt="" loading="eager" className={imageClass} />
        </picture>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30">
        <div className="page-container flex flex-col-reverse items-end gap-2.5 pb-[15px] lg:flex-row lg:justify-between lg:pb-7.5">
          <div
            className="glass-material glass-material-hero glass-material-dark w-full rounded-[20px] px-2.5 py-3.5 text-white lg:w-[599px] lg:px-7.5 lg:pt-6 lg:pb-5"
          >
            <p className="text-sm leading-[17px] lg:text-[23px] lg:leading-[29px]">{hero.lead}</p>
            <ButtonLink href="#order" className="mt-2.5 h-[42px] lg:mt-4 lg:h-14">
              {hero.cta}
            </ButtonLink>
          </div>

          <ContactPill className="lg:mb-[37px] lg:h-[72px] lg:px-3" />
        </div>
      </div>
    </header>
  );
}
