import { faq } from "@/content/home";
import { site } from "@/content/site";

// Schema.org-разметка главной: организация (HVACBusiness) и FAQ.
export function homeStructuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "HVACBusiness",
      name: site.name,
      description: site.description,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      image: `${site.url}/opengraph-image`,
      ...(site.contacts.phone ? { telephone: site.contacts.phone } : {}),
      email: site.contacts.email,
      foundingDate: String(site.foundedYear),
      address: {
        "@type": "PostalAddress",
        streetAddress: site.contacts.address.street,
        addressLocality: "Москва",
        addressCountry: "RU",
      },
      areaServed: ["Москва", "Московская область", "Россия"],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];
}
