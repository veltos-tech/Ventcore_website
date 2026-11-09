import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

// В обоих PDF основные кнопки — сплошные прямоугольники без стеклянного слоя.
export const buttonClass =
  "button-primary inline-flex w-full items-center justify-center bg-blue px-5 text-2xl leading-none text-white transition-colors duration-200 hover:bg-blue-600 active:bg-[#025f9f] disabled:cursor-not-allowed disabled:opacity-60";

export function ButtonLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClass, className)} {...props} />;
}

export function Button({ className, type = "button", ...props }: ComponentProps<"button">) {
  return <button type={type} className={cn(buttonClass, className)} {...props} />;
}
