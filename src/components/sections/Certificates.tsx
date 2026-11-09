import { SectionHeader } from "@/components/ui/SectionHeader";
import { certificates } from "@/content/home";

import { CertificatesGrid } from "./CertificatesGrid";

export function Certificates() {
  return (
    <section id="certificates" aria-labelledby="certificates-title" className="page-container pt-15 lg:pt-30">
      <SectionHeader
        id="certificates-title"
        label={certificates.label}
        title={certificates.title}
        className="[&>h2]:leading-[1.65] lg:[&>h2]:leading-normal"
      />
      <CertificatesGrid items={certificates.items} />
    </section>
  );
}
