"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { ChevronRightIcon, CloseIcon, PlusIcon } from "@/components/icons/ui-icons";
import { certificates } from "@/content/home";
import { cn } from "@/lib/cn";
import { typo } from "@/lib/typography";

type Certificate = { id: number; brand: string; logo: StaticImageData };

// Сетка 2×4 (мобильные) / 4×2 (десктоп). По клику страница размывается, выбранная
// карточка остаётся чёткой, плюс становится синей стрелкой, а панель выезжает на
// колонку целиком — обе карточки (логотипы тоже закрываются); панель прямоугольная.
// На телефоне панель закрывает всю сетку.
export function CertificatesGrid({ items }: { items: Certificate[] }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0 ? items[activeIndex] : null;

  const close = () => {
    setActiveId(null);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (activeId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveId(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeId]);

  return (
    <>
      {/* Размытие всего, что за выбранной карточкой; клик закрывает панель */}
      <div
        aria-hidden="true"
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-white/40 backdrop-blur-md transition-opacity duration-300",
          active ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="relative mt-6 lg:mt-6">
      <ul className="grid grid-cols-2 lg:grid-cols-4 lg:gap-x-2.5">
        {items.map((item, i) => {
          const number = String(item.id).padStart(2, "0");
          const isActive = item.id === activeId;

          return (
            <li
              key={item.id}
              className={cn(
                "relative py-4 lg:py-2.5",
                // на десктопе горизонтальная линия перекрывает зазор между колонками
                i % 4 !== 3 && "lg:-mr-2.5",
                i < items.length - 2 && "border-b border-line",
                i >= items.length - 4 && "lg:border-b-0",
                isActive && "z-50 bg-white",
              )}
            >
              <button
                type="button"
                onClick={(event) => {
                  if (isActive) return close();
                  triggerRef.current = event.currentTarget;
                  setActiveId(item.id);
                }}
                aria-expanded={isActive}
                aria-controls={isActive ? "certificate-panel" : undefined}
                aria-label={`Сертификат ${number}: ${item.brand}`}
                className={cn(
                  "group flex h-full min-h-39 w-full flex-col justify-between pr-2 text-left lg:min-h-57.5 lg:pr-5",
                  i % 2 === 1 && "border-l border-line pl-5 lg:pl-2.5",
                  i % 4 === 2 && "lg:border-l lg:border-line lg:pl-2.5",
                )}
              >
                {/* Логотипы разной пропорции вписываются в одну область */}
                <span className="block h-12 max-w-[140px] pt-1 lg:h-[72px] lg:max-w-[250px] lg:pt-3">
                  <Image
                    src={item.logo}
                    alt={item.brand}
                    sizes="(min-width: 1024px) 250px, 140px"
                    className="size-full object-contain object-left"
                  />
                </span>
                <span className="flex items-end justify-between gap-2">
                  <span className="font-display text-[32px] leading-none font-bold lg:text-5xl">
                    {number}
                  </span>
                  <span
                    className={cn(
                      "relative mb-1 size-6.5 shrink-0 transition-colors duration-300",
                      isActive && "mb-0 size-10 bg-blue text-white lg:size-[42px]",
                    )}
                  >
                    <PlusIcon
                      className={cn(
                        "absolute inset-0 transition duration-300 group-hover:rotate-90 group-hover:opacity-0",
                        isActive && "opacity-0",
                      )}
                    />
                    <ChevronRightIcon
                      className={cn(
                        "absolute inset-0 m-auto h-4 w-4 transition duration-300",
                        isActive
                          ? "translate-x-0 opacity-100"
                          : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                      )}
                    />
                  </span>
                </span>
              </button>

            </li>
          );
        })}
      </ul>

      {/* Слой с такой же сеткой, как у карточек: на десктопе панель закрывает колонку
          целиком (два блока), на телефоне — всю сетку */}
      {active && (
        <div className="pointer-events-none absolute inset-0 z-50 lg:grid lg:grid-cols-4 lg:grid-rows-2 lg:gap-x-2.5">
          <Panel
            certificate={active}
            onClose={close}
            fromTop={activeIndex < 4}
            style={{ "--col": (activeIndex % 4) + 1, "--mr": activeIndex % 4 === 3 ? "0px" : "-10px" } as CSSProperties}
          />
        </div>
      )}
      </div>
    </>
  );
}

function Panel({
  certificate,
  onClose,
  fromTop,
  style,
}: {
  certificate: Certificate;
  onClose: () => void;
  fromTop: boolean;
  style: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Фокус внутрь панели, чтобы Tab читался с неё
  useEffect(() => ref.current?.focus(), []);

  return (
    <div
      ref={ref}
      id="certificate-panel"
      role="dialog"
      aria-label={`Сертификат: ${certificate.brand}`}
      tabIndex={-1}
      style={style}
      data-from={fromTop ? "top" : "bottom"}
      className="certificate-panel pointer-events-auto absolute inset-0 flex flex-col gap-3 bg-white p-3 shadow-[0_20px_60px_-20px_rgb(4_27_51/0.45)] outline-none lg:static lg:col-start-(--col) lg:row-span-2 lg:row-start-1 lg:mr-(--mr)"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute top-3 right-3 z-10 grid size-10 place-items-center bg-white text-navy shadow-md lg:hidden"
      >
        <CloseIcon className="size-4" />
      </button>

      {/* Карточка закрыта панелью — логотип показываем в ней */}
      <span className="block h-10 max-w-[140px] lg:h-12 lg:max-w-[220px]">
        <Image
          src={certificate.logo}
          alt=""
          sizes="220px"
          className="size-full object-contain object-left"
        />
      </span>

      {/* TODO: когда появятся сканы, добавить блок со сканом сертификата (next/image, object-contain) */}
      {/* Текст прижат к низу, как номер в карточке; сверху — акцентная линия */}
      <div className="mt-auto border-t-2 border-blue pt-5 lg:pt-6">
        <p className="font-display text-[28px] leading-[1.1] font-bold text-navy lg:text-[32px]">
          {certificates.company}
        </p>
        <p className="mt-1 text-base text-muted">{certificates.city}</p>

        <p className="mt-5 text-[19px] leading-[1.4] text-navy lg:mt-6 lg:text-[20px]">
          {typo(certificates.statement.verb)}{" "}
          <strong className="font-semibold text-blue">{typo(certificates.statement.role)}</strong>{" "}
          {typo(certificates.statement.object)}{" "}
          <strong className="font-bold whitespace-nowrap">{certificate.brand}</strong>{" "}
          {typo(certificates.statement.territory)}
        </p>
      </div>
    </div>
  );
}
