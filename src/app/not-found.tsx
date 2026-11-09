import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="page-container flex min-h-svh flex-col justify-center gap-8 py-16">
      <Logo className="max-w-[560px]" />
      <div>
        <p className="font-display text-[64px] leading-none font-bold lg:text-[96px]">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold lg:text-[32px]">
          Страница пока в разработке или не найдена
        </h1>
      </div>
      <ButtonLink href="/" className="max-w-[380px]">
        На главную
      </ButtonLink>
    </main>
  );
}
