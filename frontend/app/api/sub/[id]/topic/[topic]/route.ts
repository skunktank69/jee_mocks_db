import { NextResponse } from "next/server";

type Params = { id: string; topic: string };

const RAW_BASE =
  "https://raw.githubusercontent.com/skunktank69/jee_mocks_db/refs/heads/master/mocks_jsonl";

function parseJsonl(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const data: any[] = [];
  const parseErrors: Array<{ line: number; message: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      data.push(JSON.parse(lines[i]));
    } catch (e: any) {
      parseErrors.push({ line: i + 1, message: e?.message ?? "Invalid JSON" });
    }
  }

  return { data, parseErrors, totalLines: lines.length };
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { id, topic } = await context.params;

  const url = `${RAW_BASE}/${encodeURIComponent(id)}/${encodeURIComponent(
    topic,
  )}.jsonl`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return NextResponse.json(
      {
        error: "Failed to fetch topic JSONL",
        id,
        topic,
        url,
        status: res.status,
      },
      { status: res.status === 404 ? 404 : 500 },
    );
  }

  const text = await res.text();
  const { data, parseErrors, totalLines } = parseJsonl(text);

  if (totalLines > 0 && data.length === 0) {
    return NextResponse.json(
      {
        error: "JSONL fetched but no valid lines parsed",
        id,
        topic,
        url,
        parseErrors: parseErrors.slice(0, 10),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id,
    topic,
    url,
    count: data.length,
    parseErrors: parseErrors.length ? parseErrors.slice(0, 10) : [],
    data,
  });
}
