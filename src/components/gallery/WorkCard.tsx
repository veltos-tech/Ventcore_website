"use client";

import Image from "next/image";
import { useState } from "react";

import type { GalleryWork } from "@/content/gallery";
import { typo } from "@/lib/typography";

export function WorkCard({ work }: { work: GalleryWork }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const expanded = pinned || (!dismissed && (hovered || focused));
  const descriptionId = `${work.id}-description`;

  function close() {
    setPinned(false);
    setFocused(false);
    setDismissed(true);
  }

  return (
    <figure
      id={work.id}
      className="work-card relative isolate aspect-[665/497] scroll-mt-6 overflow-hidden rounded-card bg-navy-900 max-[359px]:aspect-square"
      data-expanded={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches) setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <Image
        src={work.image}
        alt={work.alt}
        fill
        sizes="(min-width: 1440px) 665px, (min-width: 1024px) calc((100vw - 110px) / 2), (min-width: 768px) calc((100vw - 50px) / 2), calc(100vw - 40px)"
        className="work-card-image object-cover"
      />
      <figcaption
        id={descriptionId}
        className="work-card-description glass-material glass-material-gallery absolute inset-0 flex flex-col justify-center rounded-card text-white"
        aria-hidden={!expanded}
      >
        <h2 className="work-card-title font-display font-extrabold">
          {work.details.title}
        </h2>
        <p className="work-card-copy">
          {typo(work.details.text)}
        </p>
        <ul className="work-card-facts">
          {work.details.facts.map((fact) => <li key={fact}>{typo(fact)}</li>)}
        </ul>
      </figcaption>
      <button
        type="button"
        className="work-card-toggle absolute inset-0 z-10 cursor-pointer rounded-card text-left"
        aria-expanded={expanded}
        aria-controls={descriptionId}
        aria-label={`${expanded ? "Закрыть" : "Показать"} описание: ${work.details.title}`}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) {
            setFocused(true);
            setDismissed(false);
          }
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          if (expanded) close();
          else {
            setDismissed(false);
            setPinned(true);
          }
        }}
      >
        <span className="work-card-hint absolute right-4 bottom-4 rounded-full border border-white/35 bg-navy/75 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
          Описание работ <span aria-hidden="true" className="ml-1">+</span>
        </span>
      </button>
    </figure>
  );
}
