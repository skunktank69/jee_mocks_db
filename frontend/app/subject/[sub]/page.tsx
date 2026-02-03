import TopicsClient from "./topics-client";
import { headers } from "next/headers";

type ApiResponse = {
  subject: string;
  topics: string[];
};

async function makeAbsoluteUrl(pathname: string) {
  const h = await headers(); // ← THIS was the bug

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";

  const proto = h.get("x-forwarded-proto") ?? "http";
  // console.log(pathname);

  return `${proto}://${host}${pathname}`;
}

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;

  const url = makeAbsoluteUrl(`/api/sub/${encodeURIComponent(await sub)}`);
  const res = await fetch(await url, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Failed to load topics</h1>
        <p className="text-sm opacity-80">API error: HTTP {res.status}</p>
      </div>
    );
  }

  const data = (await res.json()) as ApiResponse;

  return (
    <div className="p-6">
      <TopicsClient sub={sub} subject={data.subject} topics={data.topics} />
    </div>
  );
}
