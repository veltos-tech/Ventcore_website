export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Экранируем "<", чтобы содержимое не могло закрыть тег script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
