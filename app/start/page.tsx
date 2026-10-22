import { redirect } from "next/navigation";
/** Keep identity and learning at the original root; an explicit locale is presentation only. */
export default async function StartPage({ searchParams }: { searchParams?: Promise<Record<string,string|string[]|undefined>> } = {}) {
  const params = searchParams ? await searchParams : {};
  const requested = params.lang;
  const suffix = requested === "ko" || requested === "en" ? `&lang=${requested}` : "";
  redirect(`/?source=landing${suffix}`);
}
