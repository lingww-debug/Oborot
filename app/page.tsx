import { isPalette } from "../lib/content";
import { getAdmin, readPublicSite } from "../lib/site-server";
import { Storefront } from "./storefront";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ palette?: string | string[] }>;
}) {
  const [data, admin, query] = await Promise.all([readPublicSite(), getAdmin(), searchParams]);
  const preview = isPalette(query.palette) ? query.palette : undefined;
  return <Storefront {...data} admin={Boolean(admin)} preview={preview} />;
}
