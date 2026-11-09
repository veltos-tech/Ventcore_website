import { Inter, Manrope } from "next/font/google";

// Основной текст макета — Inter.
export const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Заголовки в макете набраны геометрическим гротеском (близко к Gilroy).
// Manrope — бесплатная замена с кириллицей. Если у заказчика есть лицензия
// на фирменный шрифт — подключить его через next/font/local с той же переменной.
export const display = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display-face",
  display: "swap",
});
