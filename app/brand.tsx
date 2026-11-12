export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /></span>;
}

export function Brand({ href = "/" }: { href?: string }) {
  return <a className="brand" href={href}><BrandMark /><span>ОБОРОТ</span></a>;
}
