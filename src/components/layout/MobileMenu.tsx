"use client";

import { useCallback, useRef, useState, type CSSProperties, type MouseEvent } from "react";

import { MenuIcon } from "@/components/icons/ui-icons";
import { ContactPill } from "@/components/ui/ContactPill";
import { Logo } from "@/components/ui/Logo";
import { emailHref, mainNav, phoneHref, site } from "@/content/site";

// Если animationend не придёт (вкладка в фоне и т. п.) — закрываем по таймеру.
const CLOSE_FALLBACK_MS = 450;

/** Порядковый номер для каскадного появления пунктов (см. globals.css). */
const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    dialogRef.current?.showModal();
    setIsOpen(true);
  };

  // Закрытие с анимацией: помечаем диалог [data-closing], ждём конца
  // сворачивания панели и только потом вызываем close().
  const close = useCallback((afterClose?: () => void) => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.hasAttribute("data-closing")) return;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      dialog.removeEventListener("animationend", onAnimationEnd);
      dialog.removeAttribute("data-closing");
      dialog.close();
      afterClose?.();
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "menu-panel-out") finish();
    };

    dialog.addEventListener("animationend", onAnimationEnd);
    dialog.setAttribute("data-closing", "");
    window.setTimeout(finish, CLOSE_FALLBACK_MS);
  }, []);

  // Якорные ссылки: сначала сворачиваем меню, потом прокручиваем к разделу —
  // иначе возврат фокуса на кнопку меню после close() сбил бы прокрутку.
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href");
    if (!href?.startsWith("#")) return close();
    event.preventDefault();
    close(() => {
      document.querySelector(href)?.scrollIntoView();
      history.pushState(null, "", href);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Открыть меню"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        className="grid size-11 content-start justify-start pt-2 text-navy lg:hidden"
      >
        <MenuIcon className="h-5 w-[23px]" />
      </button>

      <dialog
        id="mobile-menu"
        ref={dialogRef}
        aria-label="Меню"
        className="mobile-menu m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-white"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setIsOpen(false)}
      >
        <div className="mobile-menu__panel glass-material glass-material-menu absolute inset-x-2.5 top-2.5 rounded-[28px]">
          {/* Кнопка стоит ровно на месте бургера: его линии превращаются в крестик */}
          <button
            type="button"
            onClick={() => close()}
            aria-label="Закрыть меню"
            className="absolute top-0 left-0 z-10 size-11 p-2.5"
          >
            <span aria-hidden="true" className="relative block h-5 w-[23px]">
              <span className="menu-toggle-line" />
              <span className="menu-toggle-line" />
              <span className="menu-toggle-line" />
            </span>
          </button>

          <div className="max-h-[calc(100dvh-20px)] overflow-y-auto overscroll-contain px-4 pb-5">
            <div data-menu-item style={stagger(0)} className="flex h-11 items-center justify-end pt-1">
              <div className="w-[150px]">
                <Logo tone="light" />
              </div>
            </div>

            <nav aria-label="Основное меню" className="mt-4">
              <ul className="divide-y divide-white/12">
                {mainNav.map((item, index) => (
                  <li key={item.href} data-menu-item style={stagger(index + 1)}>
                    <a
                      href={item.href}
                      onClick={navigate}
                      className="block py-3 font-display text-[28px] leading-tight font-semibold transition-colors active:text-sky"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div data-menu-item style={stagger(mainNav.length + 1)} className="mt-5">
              <a
                href="#order"
                onClick={navigate}
                className="glass-material glass-material-blue flex h-[46px] items-center justify-center rounded-[20px] font-display text-xl"
              >
                Заказать расчёт
              </a>
            </div>

            <div
              data-menu-item
              style={stagger(mainNav.length + 2)}
              className="mt-5 flex items-end justify-between gap-4"
            >
              <div className="flex min-w-0 flex-col gap-1 text-base">
                {phoneHref && (
                  <a href={phoneHref} onClick={navigate} className="font-medium">
                    {site.contacts.phone}
                  </a>
                )}
                <a href={emailHref} onClick={navigate} className={phoneHref ? "text-white/75" : "font-medium"}>
                  {site.contacts.email}
                </a>
              </div>
              <ContactPill className="shrink-0" />
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
