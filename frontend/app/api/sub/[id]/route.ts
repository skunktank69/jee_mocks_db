import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  type DataShape = {
    Mathematics: Record<string, unknown>;
    Physics: Record<string, unknown>;
    Chemistry: Record<string, unknown>;
  };

  const { id } = await context.params;

  const url =
    "https://raw.githubusercontent.com/skunktank69/jee_mocks_db/refs/heads/master/topic_list.json";

  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch topic list" },
      { status: 500 },
    );
  }

  const data: DataShape = await res.json();

  const key = id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();

  if (!(key in data)) {
    return NextResponse.json(
      { error: `Invalid subject: ${id}` },
      { status: 404 },
    );
  }

  const topics = Object.keys(data[key as keyof DataShape]);

  return NextResponse.json({
    subject: key,
    topics,
  });
}
