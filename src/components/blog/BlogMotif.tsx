export function BlogMotif({ blue = false }: { blue?: boolean }) {
  return (
    <div aria-hidden="true" className={`blog-motif${blue ? " blog-motif-blue" : ""}`}>
      <span /><span /><span /><span />
    </div>
  );
}
