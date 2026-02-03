"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MockQuestion = {
  id: string;
  subject: string;
  chapter: string;
  type: "mcq" | "value";
  examHtml: string;
  promptHtml: string;
  options: Array<{ key: string; html: string }>;
  correctAnswer?: string;
};

type MockPayload = {
  createdAt: string;
  expiresAt: string;
  durationSeconds: number;
  maxQuestions: number;
  chapters: string[];
  questions: MockQuestion[];
};

const TIME_LIMIT_SECONDS = 20 * 60;
const MARKS_CORRECT = 4;
const MARKS_WRONG = -1;

function base64urlToUint8Array(b64url: string) {
  const b64 =
    b64url.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function norm(x: unknown) {
  return String(x ?? "")
    .trim()
    .toUpperCase();
}

async function gunzipToJson<T>(token: string): Promise<T> {
  const bytes = base64urlToUint8Array(token);
  // @ts-ignore - CompressionStream is supported in modern browsers
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return JSON.parse(text) as T;
}

type Verdict = "correct" | "wrong" | "unattempted";

type BreakdownRow = {
  index: number;
  id: string;
  chapter: string;
  type: "mcq" | "value";
  userAnswer: string;
  correctAnswer: string;
  verdict: Verdict;
  marks: number;
};

type ComputedResult = {
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  marksCorrect: number;
  marksWrong: number;
  netMarks: number;
  maxMarks: number;
  accuracyPercent: number;
  scorePercent: number;
  breakdown: BreakdownRow[];
};

function computeResult(
  mock: MockPayload,
  answers: Record<string, string>,
): ComputedResult {
  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  const breakdown: BreakdownRow[] = [];

  for (let i = 0; i < mock.questions.length; i++) {
    const q = mock.questions[i];
    const ua = (answers[q.id] ?? "").trim();
    const ca = (q.correctAnswer ?? "").trim();

    let verdict: Verdict = "unattempted";
    let marks = 0;

    if (!ua) {
      unattempted++;
      verdict = "unattempted";
      marks = 0;
    } else if (ca && norm(ua) === norm(ca)) {
      attempted++;
      correct++;
      verdict = "correct";
      marks = MARKS_CORRECT;
    } else {
      attempted++;
      wrong++;
      verdict = "wrong";
      marks = MARKS_WRONG;
    }

    breakdown.push({
      index: i,
      id: q.id,
      chapter: q.chapter,
      type: q.type,
      userAnswer: ua || "-",
      correctAnswer: ca || "-",
      verdict,
      marks,
    });
  }

  const marksCorrect = correct * MARKS_CORRECT;
  const marksWrong = wrong * MARKS_WRONG;
  const netMarks = marksCorrect + marksWrong;
  const maxMarks = mock.questions.length * MARKS_CORRECT;

  const accuracyPercent =
    attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

  const scorePercentRaw = maxMarks > 0 ? (netMarks / maxMarks) * 100 : 0;
  const scorePercent = Math.max(0, Math.round(scorePercentRaw * 10) / 10);

  return {
    totalQuestions: mock.questions.length,
    attempted,
    correct,
    wrong,
    unattempted,
    marksCorrect,
    marksWrong,
    netMarks,
    maxMarks,
    accuracyPercent,
    scorePercent,
    breakdown,
  };
}

function newSessionStartKey(token: string) {
  return `mock_start_v1:${token.slice(0, 48)}`;
}

function readOrInitSessionStart(token: string) {
  const key = newSessionStartKey(token);
  const now = Date.now();

  try {
    const existing = localStorage.getItem(key);
    if (existing) {
      const t = Number(existing);
      if (Number.isFinite(t) && t > 0) return t;
    }
    localStorage.setItem(key, String(now));
  } catch {
    // ignore
  }

  return now;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/* -------------------------
   LaTeX (MathJax) support
   Fixed to prevent flickering
-------------------------- */
function useMathJax() {
  const readyRef = useRef<Promise<void> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const w = window as any;

    if (!readyRef.current) {
      readyRef.current = new Promise<void>((resolve) => {
        // If already loaded, resolve immediately
        if (w.MathJax && (w.MathJax.typesetPromise || w.MathJax.typeset)) {
          setIsReady(true);
          resolve();
          return;
        }

        // Config BEFORE script
        w.MathJax = w.MathJax ?? {};
        w.MathJax = {
          ...w.MathJax,
          tex: {
            inlineMath: [
              ["$", "$"],
              ["\\(", "\\)"],
            ],
            displayMath: [
              ["$$", "$$"],
              ["\\[", "\\]"],
            ],
          },
          options: {
            skipHtmlTags: [
              "script",
              "noscript",
              "style",
              "textarea",
              "pre",
              "code",
            ],
          },
          startup: {
            typeset: false,
          },
        };

        // Don't double-inject
        if (document.getElementById("mathjax-script")) {
          const t = window.setInterval(() => {
            if (w.MathJax && (w.MathJax.typesetPromise || w.MathJax.typeset)) {
              window.clearInterval(t);
              setIsReady(true);
              resolve();
            }
          }, 50);
          return;
        }

        const script = document.createElement("script");
        script.id = "mathjax-script";
        script.async = true;
        script.src =
          "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
        script.onload = () => {
          setIsReady(true);
          resolve();
        };
        document.head.appendChild(script);
      });
    }
  }, []);

  const typesetNode = async (node: HTMLElement | null) => {
    if (!node) return;
    await readyRef.current;

    const mj = (window as any).MathJax;
    if (!mj) return;

    try {
      // Clear previous typesetting
      if (mj.typesetClear) mj.typesetClear([node]);

      // Typeset the node
      if (mj.typesetPromise) {
        await mj.typesetPromise([node]);
      } else if (mj.typeset) {
        mj.typeset([node]);
      }
    } catch (err) {
      console.warn("MathJax typeset error:", err);
    }
  };

  return { typesetNode, isReady };
}

export default function MockClient({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { typesetNode, isReady } = useMathJax();

  const [mock, setMock] = useState<MockPayload | null>(null);
  const [token, setToken] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);

  const [remainingMs, setRemainingMs] = useState<number>(
    TIME_LIMIT_SECONDS * 1000,
  );
  const [submitted, setSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isTypesetting, setIsTypesetting] = useState(false);

  // refs for MathJax scoping
  const questionRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // decode mock
  useEffect(() => {
    (async () => {
      const sp = await searchParams;
      const t = sp.m ?? "";
      if (!t) {
        setErr("Missing token. Open this page with /mock?m=...");
        return;
      }

      setToken(t);

      try {
        const data = await gunzipToJson<MockPayload>(t);
        if (!data?.questions?.length) {
          setErr("Invalid mock payload.");
          return;
        }
        setMock(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to decode mock token.");
      }
    })();
  }, [searchParams]);

  // 20 min timer
  useEffect(() => {
    if (!token || submitted) return;

    const start = readOrInitSessionStart(token);

    const tick = () => {
      const elapsed = Date.now() - start;
      const left = TIME_LIMIT_SECONDS * 1000 - elapsed;
      setRemainingMs(left);

      if (left <= 0) {
        setSubmitted(true);
        setShowModal(true);
      }
    };

    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [token, submitted]);

  const q = mock?.questions[current];
  const total = mock?.questions.length ?? 0;

  const result = useMemo(() => {
    if (!mock || !submitted) return null;
    return computeResult(mock, answers);
  }, [mock, submitted, answers]);

  const timeUp = remainingMs <= 0;

  function setAnswer(v: string) {
    if (!q || submitted) return;
    setAnswers((a) => ({ ...a, [q.id]: v }));
  }

  function prev() {
    setCurrent((c) => Math.max(0, c - 1));
  }

  function next() {
    if (!mock) return;
    setCurrent((c) => Math.min(c + 1, mock.questions.length - 1));
  }

  function submitNow() {
    setSubmitted(true);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  function jumpTo(i: number) {
    setCurrent(clamp(i, 0, total - 1));
    setShowModal(false);
  }

  // MathJax: typeset after question DOM updates
  useEffect(() => {
    if (!mock || !isReady) return;

    setIsTypesetting(true);

    // Small delay to let DOM settle
    const timer = setTimeout(async () => {
      await typesetNode(questionRef.current);
      setIsTypesetting(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [mock, current, typesetNode, isReady]);

  // MathJax: typeset when modal opens
  useEffect(() => {
    if (!showModal || !isReady) return;

    const timer = setTimeout(async () => {
      await typesetNode(modalRef.current);
    }, 50);

    return () => clearTimeout(timer);
  }, [showModal, submitted, typesetNode, isReady]);

  if (err) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Mock</h1>
        <p className="mt-2 text-sm opacity-80">{err}</p>
      </div>
    );
  }

  if (!mock || !q) return <div className="p-6">Loading...</div>;

  const isLast = current === total - 1;
  const currentAnswer = (answers[q.id] ?? "").trim();

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <style jsx global>{`
        .mock-prose img {
          display: inline-block;
          height: 10vh !important;
          max-width: 240px;
          object-fit: contain;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.04);
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-xs opacity-70">Chapters</div>
          <div className="text-sm">{mock.chapters.join(", ")}</div>
          <div className="text-xs opacity-60 mt-1">
            Q{current + 1}/{total}
          </div>
          <div className="text-xs opacity-60 mt-1">
            Marking: +{MARKS_CORRECT} / {MARKS_WRONG} / 0
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs opacity-70">Time left</div>
          <div className="text-lg font-semibold">{msToClock(remainingMs)}</div>

          <button
            type="button"
            className="mt-2 px-2 py-1 border rounded text-xs"
            onClick={() => setShowModal(true)}
            disabled={!submitted}
            title={!submitted ? "Submit to view analysis" : "View analysis"}
          >
            View analysis
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,200px] gap-4">
        {/* Question panel */}
        <div>
          <div
            ref={questionRef}
            className="w-full p-3 border rounded transition-opacity duration-200"
            style={{ opacity: isTypesetting ? 0.3 : 1 }}
          >
            <div className="text-xs opacity-70 mb-2">
              Q{current + 1} • {q.chapter} • {q.type.toUpperCase()}
            </div>

            {q.examHtml ? (
              <div
                className="mb-2 text-sm opacity-80 mock-prose"
                dangerouslySetInnerHTML={{ __html: q.examHtml }}
              />
            ) : null}

            <div
              className="prose mock-prose text-sm"
              dangerouslySetInnerHTML={{ __html: q.promptHtml }}
            />

            {q.type === "mcq" ? (
              <div className="mt-3 grid gap-2">
                {q.options.map((op) => {
                  const active = currentAnswer === op.key;
                  return (
                    <button
                      key={op.key}
                      type="button"
                      className={[
                        "text-left rounded p-2 border transition text-sm h-fit",
                        active
                          ? "bg-muted border-2 border-yellow-400"
                          : "border",
                      ].join(" ")}
                      onClick={() => setAnswer(op.key)}
                      disabled={submitted}
                    >
                      <div className="font-mono text-xs mb-1">{op.key}</div>
                      <div
                        className="prose max-w-full mock-prose"
                        dangerouslySetInnerHTML={{ __html: op.html }}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3">
                <input
                  className="w-full border rounded p-2 text-sm"
                  placeholder="Type your answer…"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={submitted}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="px-3 py-1.5 border rounded text-sm"
                onClick={prev}
                type="button"
                disabled={current === 0}
              >
                Prev
              </button>

              {!submitted ? (
                isLast ? (
                  <button
                    className="px-3 py-1.5 border rounded text-sm"
                    onClick={submitNow}
                    type="button"
                  >
                    Submit
                  </button>
                ) : (
                  <button
                    className="px-3 py-1.5 border rounded text-sm"
                    onClick={next}
                    type="button"
                  >
                    Next
                  </button>
                )
              ) : (
                <button
                  className="px-3 py-1.5 border rounded text-sm"
                  onClick={() => setShowModal(true)}
                  type="button"
                >
                  View analysis
                </button>
              )}
            </div>

            {!submitted && timeUp ? (
              <div className="mt-2 text-xs text-red-500">
                Time up. Auto-submitting…
              </div>
            ) : null}
          </div>
        </div>

        {/* Question Palette Sidebar */}
        <div className="lg:sticky lg:top-4 h-fit">
          <div className="border rounded p-3">
            <h3 className="text-sm font-semibold mb-2">Question Palette</h3>

            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {mock.questions.map((_, i) => {
                const attempted =
                  (answers[mock.questions[i].id] ?? "").trim() !== "";
                return (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`
                      aspect-square rounded text-xs font-semibold transition-all
                      ${
                        i === current
                          ? "bg-blue-600 text-white ring-2 ring-blue-400"
                          : attempted
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }
                    `}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 text-xs border-t border-slate-200 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
                <span className="text-slate-600">Attempted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100 border border-slate-300" />
                <span className="text-slate-600">Not Attempted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-600" />
                <span className="text-slate-600">Current</span>
              </div>
            </div>

            {!submitted && (
              <button
                className="w-full mt-3 px-3 py-1.5 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition-all"
                onClick={submitNow}
                type="button"
              >
                Submit Test
              </button>
            )}
          </div>
        </div>
      </div>

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
            type="button"
            aria-label="Close modal backdrop"
          />

          <div
            ref={modalRef}
            className="relative w-full max-w-4xl bg-background border rounded-xl shadow-xl p-4 max-h-[90vh] overflow-auto"
          >
            {!submitted || !result ? (
              <>
                <div className="text-base font-semibold">Analysis locked</div>
                <div className="mt-2 text-sm opacity-80">
                  Submit the mock to view score + analysis.
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs opacity-70">Result</div>
                    <div className="text-xl font-semibold">
                      {result.netMarks} / {result.maxMarks} (
                      {result.scorePercent}%)
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {timeUp ? "Time up." : "Submitted."} • Accuracy:{" "}
                      {result.accuracyPercent}%
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="border rounded p-2">
                    <div className="text-xs opacity-70">Correct</div>
                    <div className="text-lg font-semibold">
                      {result.correct}
                    </div>
                    <div className="text-xs opacity-70">
                      +{result.marksCorrect}
                    </div>
                  </div>

                  <div className="border rounded p-2">
                    <div className="text-xs opacity-70">Wrong</div>
                    <div className="text-lg font-semibold">{result.wrong}</div>
                    <div className="text-xs opacity-70">
                      {result.marksWrong}
                    </div>
                  </div>

                  <div className="border rounded p-2">
                    <div className="text-xs opacity-70">Unattempted</div>
                    <div className="text-lg font-semibold">
                      {result.unattempted}
                    </div>
                    <div className="text-xs opacity-70">+0</div>
                  </div>

                  <div className="border rounded p-2">
                    <div className="text-xs opacity-70">Attempted</div>
                    <div className="text-lg font-semibold">
                      {result.attempted}
                    </div>
                    <div className="text-xs opacity-70">
                      Total: {result.totalQuestions}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold mb-2">
                    Per-question analysis
                  </div>

                  <div className="max-h-[50vh] overflow-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr className="text-left">
                          <th className="p-2">Q</th>
                          <th className="p-2">Chapter</th>
                          <th className="p-2">Ans</th>
                          <th className="p-2">Correct</th>
                          <th className="p-2">Verdict</th>
                          <th className="p-2">Marks</th>
                          <th className="p-2">Jump</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.breakdown.map((b) => (
                          <tr key={b.id} className="border-b last:border-b-0">
                            <td className="p-2">Q{b.index + 1}</td>
                            <td className="p-2">{b.chapter}</td>
                            <td className="p-2 font-mono">{b.userAnswer}</td>
                            <td className="p-2 font-mono">{b.correctAnswer}</td>
                            <td className="p-2">
                              <span
                                className={[
                                  "px-1.5 py-0.5 rounded text-xs border",
                                  b.verdict === "correct"
                                    ? "bg-green-500/10"
                                    : b.verdict === "wrong"
                                      ? "bg-red-500/10"
                                      : "bg-muted",
                                ].join(" ")}
                              >
                                {b.verdict}
                              </span>
                            </td>
                            <td className="p-2 font-mono">{b.marks}</td>
                            <td className="p-2">
                              <button
                                type="button"
                                className="px-1.5 py-0.5 border rounded text-xs"
                                onClick={() => jumpTo(b.index)}
                              >
                                Go
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-xs opacity-70">
                    Timer is 20 minutes per user/device (localStorage-based).
                    Marking: +{MARKS_CORRECT} correct, {MARKS_WRONG} wrong, 0
                    unattempted.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
