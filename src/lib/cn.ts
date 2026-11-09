/** Склеивает классы, отбрасывая пустые значения. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
