import type { SVGProps } from "react";

// Интерфейсные иконки (24×24). Цвет — currentColor, размер — через className.
type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function TelegramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M21.7 3.3a1.2 1.2 0 0 0-1.25-.2L2.9 10.05c-.98.39-.96 1.79.03 2.14l4.3 1.53 1.66 5.3c.22.7 1.09.93 1.62.43l2.45-2.3 4.37 3.2c.67.49 1.62.12 1.79-.69L22.1 4.47a1.2 1.2 0 0 0-.4-1.17ZM9.55 14.1l-.36 3.37-1.2-3.86 9.6-6.28-8.04 6.77Z"
      />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2.5" {...stroke} strokeWidth={1.8} />
      <path d="m3.5 6.5 7.4 6a1.75 1.75 0 0 0 2.2 0l7.4-6" {...stroke} strokeWidth={1.8} />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        {...stroke}
        d="M5.1 3.5h2.6l1.5 4-2 1.3a10.6 10.6 0 0 0 5 5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3.1 5.7a2 2 0 0 1 2-2.2Z"
      />
      <path {...stroke} d="M14.5 6.5a3.6 3.6 0 0 1 3 3M14.8 2.8a7.4 7.4 0 0 1 6.4 6.4" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...stroke} strokeWidth={2.2} strokeLinecap="butt" d="M0 3.5h24M0 12h24M0 20.5h24" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...stroke} strokeWidth={2} d="m4 4 16 16M20 4 4 20" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...stroke} strokeLinecap="butt" d="M12 1v22M1 12h22" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...stroke} strokeLinecap="butt" d="M1 12h22" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...stroke} d="m8 2 10 10L8 22" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...stroke} strokeWidth={2.4} d="M21 12H4M11 5l-7 7 7 7" />
    </svg>
  );
}
