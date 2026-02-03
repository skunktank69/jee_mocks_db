import { NextResponse } from "next/server";

type Params = { subject: string };

type IndexShape = {
  subjects?: Record<
    string,
    {
      topicList?: string[];
      topics?: Record<string, unknown>;
    }
  >;
};

const INDEX_URL =
  "https://raw.githubusercontent.com/skunktank69/jee_mocks_db/refs/heads/master/mocks_jsonl/index.json";

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { subject } = await context.params;

  const res = await fetch(INDEX_URL, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch topic index" },
      { status: 500 },
    );
  }

  const index: IndexShape = await res.json();
  const node = index.subjects?.[subject];

  if (!node) {
    return NextResponse.json(
      {
        error: `Invalid subject: ${subject}`,
        subjects: Object.keys(index.subjects ?? {}),
      },
      { status: 404 },
    );
  }

  const topics =
    node.topicList ??
    Object.keys(node.topics ?? {}).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ subject, topics, count: topics.length });
}
