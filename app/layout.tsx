import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";

export const metadata: Metadata = {
  title: "ОБОРОТ — новая жизнь вашей техники",
  description: "Купим ваш смартфон, отремонтируем привычный или поможем выбрать следующий. Скупка, ремонт и витрина смартфонов ОБОРОТ.",
  icons: { icon: "/brand.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
