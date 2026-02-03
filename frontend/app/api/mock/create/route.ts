import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { gzipSync } from "zlib";

export const runtime = "nodejs";

type IndexShape = {
  subjects?: Record<
    string,
    {
      topicList?: string[];
      topics?: Record<string, unknown>;
    }
  >;
};

type ChapterRecord = {
  subject: string;
  topic: string;
  file: string;
  rel_path?: string;
  title?: string;
  questions: Array<{
    number: number | null;
    question_type?: "mcq" | "value";
    exam_html?: string;
    text_html: string;
    options_html?: string;
    explanation_html?: string;
  }>;
  answer_key?: string[];
};

type MockQuestion = {
  id: string;
  subject: string;
  chapter: string;
  type: "mcq" | "value";
  examHtml: string;
  promptHtml: string;
  options: Array<{ key: string; html: string }>;
  correctAnswer?: string; // needed for client-side scoring
  source?: { file: string; recordTitle?: string };
};

type MockPayload = {
  createdAt: string;
  expiresAt: string; // UI uses this for timer
  durationSeconds: number;
  maxQuestions: number;
  chapters: string[];
  questions: MockQuestion[];
};

const RAW_BASE =
  "https://raw.githubusercontent.com/skunktank69/jee_mocks_db/refs/heads/master/mocks_jsonl";

const INDEX_URL = `${RAW_BASE}/index.json`;

function parseJsonl(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: ChapterRecord[] = [];
  for (let i = 0; i < lines.length; i++) out.push(JSON.parse(lines[i]));
  return out;
}

function normalize(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function splitParamList(raw: string) {
  const cleaned = raw.replace(/%2C/gi, ",");
  return cleaned
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function randomPick<T>(arr: T[], n: number) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

function parseOptions(optionsHtml: string) {
  const html = (optionsHtml || "").trim();
  if (!html) return [];

  const $ = cheerio.load(`<div id="root">${html}</div>`);
  const lis = $("#root").find("li");

  if (!lis.length) return [{ key: "A", html }];

  const out: Array<{ key: string; html: string }> = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  lis.each((i, el) => {
    const inner = $(el).html()?.trim() ?? $(el).text().trim();
    out.push({ key: letters[i] ?? String(i + 1), html: inner });
  });
  return out;
}

function inferCorrectAnswer(record: ChapterRecord, qIndex: number) {
  const ak = record.answer_key;
  if (!ak || !Array.isArray(ak) || ak.length <= qIndex) return undefined;
  const raw = String(ak[qIndex] ?? "").trim();
  return raw || undefined;
}

async function findSubjectsForChapters(index: IndexShape, chapters: string[]) {
  const subjects = index.subjects ?? {};
  const chapterToSubject: Record<string, string> = {};
  const wanted = new Set(chapters.map(normalize));

  for (const subjectName of Object.keys(subjects)) {
    const node = subjects[subjectName];
    const topicList = node?.topicList ?? Object.keys(node?.topics ?? {});
    for (const topic of topicList) {
      if (wanted.has(normalize(topic))) {
        const original = chapters.find(
          (c) => normalize(c) === normalize(topic),
        );
        if (original) chapterToSubject[original] = subjectName;
      }
    }
  }

  return chapterToSubject;
}

function base64urlFromBuffer(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeShareUrl(req: Request, token: string) {
  const u = new URL(req.url);
  return `${u.origin}/mock?m=${token}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // user param name is `subject`, but contains comma-separated chapters
  const raw = searchParams.get("subject") ?? "";
  const chapters = splitParamList(raw);

  if (!chapters.length) {
    return NextResponse.json(
      {
        error: "Missing subject param. Provide comma-separated chapter names.",
      },
      { status: 400 },
    );
  }

  const maxQuestions = Math.min(
    10,
    Math.max(1, Number(searchParams.get("max") ?? "10") || 10),
  );

  const durationSeconds = Math.min(
    60 * 60,
    Math.max(60, Number(searchParams.get("duration") ?? "1200") || 1200),
  );

  // Map chapter -> subject folder via index.json
  const indexRes = await fetch(INDEX_URL, { next: { revalidate: 3600 } });
  if (!indexRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch index.json", status: indexRes.status },
      { status: 500 },
    );
  }
  const index: IndexShape = await indexRes.json();
  const chapterToSubject = await findSubjectsForChapters(index, chapters);

  const resolvedChapters = chapters.filter((c) => chapterToSubject[c]);
  if (!resolvedChapters.length) {
    return NextResponse.json(
      {
        error: "No chapters matched index.json. Check spelling/case.",
        requested: chapters,
      },
      { status: 404 },
    );
  }

  // Build question pool
  const pool: MockQuestion[] = [];

  await Promise.all(
    resolvedChapters.map(async (chapter) => {
      const subjectName = chapterToSubject[chapter];
      const url = `${RAW_BASE}/${encodeURIComponent(subjectName)}/${encodeURIComponent(
        chapter,
      )}.jsonl`;

      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return;

      const text = await res.text();
      const records = parseJsonl(text);

      for (const record of records) {
        const qs = Array.isArray(record.questions) ? record.questions : [];
        for (let i = 0; i < qs.length; i++) {
          const q = qs[i];
          const qt =
            (q.question_type as "mcq" | "value") ||
            ((q.options_html || "").trim() ? "mcq" : "value");

          const options =
            qt === "mcq" ? parseOptions(q.options_html || "") : [];
          const correctAnswer = inferCorrectAnswer(record, i);

          pool.push({
            id: `${subjectName}::${chapter}::${record.file}::${i}`,
            subject: subjectName,
            chapter,
            type: qt,
            examHtml: (q.exam_html || "").trim(),
            promptHtml: (q.text_html || "").trim(),
            options,
            correctAnswer,
            source: { file: record.file, recordTitle: record.title },
          });
        }
      }
    }),
  );

  if (!pool.length) {
    return NextResponse.json(
      {
        error: "No questions found for the requested chapters.",
        chapters: resolvedChapters,
      },
      { status: 404 },
    );
  }

  const questions = randomPick(pool, maxQuestions);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

  const payload: MockPayload = {
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    durationSeconds,
    maxQuestions,
    chapters: resolvedChapters,
    questions,
  };

  // Compress + base64url encode so the link is shareable
  const json = JSON.stringify(payload);
  const gz = gzipSync(Buffer.from(json, "utf8"));
  const token = base64urlFromBuffer(gz);

  const shareUrl = makeShareUrl(req, token);

  return NextResponse.json(
    { shareUrl, tokenSize: token.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
