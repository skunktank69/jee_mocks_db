"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sub: string;
  subject: string;
  topics: string[];
};

function prettifyTopic(slug: string) {
  return slug
    .split("-")
    .map((w) => (w === "3d" ? "3D" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export default function TopicsClient({ sub, subject, topics }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"topicwise" | "mock">("topicwise");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.localeCompare(b)),
    [topics],
  );

  function toggleTopic(t: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(sortedTopics));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function createMock() {
    const list = [...selected];
    if (!list.length || creating) return;

    setErr(null);
    setCreating(true);

    try {
      // NOTE: your API expects `subject` but it is a comma-separated chapter list
      const chapters = encodeURIComponent(list.join(","));
      const res = await fetch(`/api/mock/create?subject=${chapters}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Mock create failed: HTTP ${res.status}${txt ? ` — ${txt}` : ""}`,
        );
      }

      const data = (await res.json()) as { shareUrl?: string };

      if (!data?.shareUrl) {
        throw new Error("Mock create failed: missing shareUrl in response");
      }

      // Shareable link returned by the API
      router.push(data.shareUrl);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create mock");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{prettifyTopic(subject)}</h1>
          <p className="text-sm opacity-80">{sortedTopics.length} topics</p>
          {err ? <p className="mt-2 text-sm text-red-500">{err}</p> : null}
        </div>

        <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded-md border text-sm ${
              mode === "topicwise"
                ? "bg-card text-foreground"
                : "bg-background text-foreground"
            }`}
            onClick={() => setMode("topicwise")}
            type="button"
          >
            Topic wise questions
          </button>
          <button
            className={`px-3 py-2 rounded-md border text-sm ${
              mode === "mock"
                ? "bg-card text-foreground"
                : "bg-background text-foreground"
            }`}
            onClick={() => setMode("mock")}
            type="button"
          >
            Create mock test
          </button>
        </div>
      </div>

      {mode === "topicwise" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTopics.map((t) => (
            <div
              key={t}
              className="rounded-xl border p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{prettifyTopic(t)}</div>
              </div>

              <details className="relative">
                <summary
                  className="list-none cursor-pointer select-none px-2 py-1 rounded-md border text-sm leading-none"
                  aria-label="Open menu"
                  title="Menu"
                >
                  &gt;
                </summary>

                <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-card shadow-lg overflow-hidden z-10">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-sidebar-accent"
                    onClick={() =>
                      router.push(
                        `/subject/${encodeURIComponent(sub)}/${encodeURIComponent(t)}`,
                      )
                    }
                  >
                    Open topic
                  </button>

                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-sidebar-accent"
                    onClick={() =>
                      router.push(
                        `/subject/${encodeURIComponent(sub)}/${encodeURIComponent(
                          t,
                        )}/questions`,
                      )
                    }
                  >
                    View questions
                  </button>
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm opacity-80">
              Select topics to include in the mock.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-md border text-sm"
                onClick={selectAll}
                disabled={creating}
              >
                Select all
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-md border text-sm"
                onClick={clearAll}
                disabled={creating}
              >
                Clear
              </button>

              <button
                type="button"
                className={`px-3 py-2 rounded-md border text-sm ${
                  selected.size && !creating
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                onClick={createMock}
                disabled={!selected.size || creating}
              >
                {creating ? "Creating..." : "Create mock"}
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sortedTopics.map((t) => {
              const checked = selected.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  disabled={creating}
                  className={`text-left rounded-xl border p-3 transition ${
                    checked
                      ? "bg-card text-foreground"
                      : "bg-background text-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {prettifyTopic(t)}
                      </div>
                      <div
                        className={`text-xs truncate ${
                          checked ? "opacity-80" : "opacity-70"
                        }`}
                      >
                        {t}
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                        checked ? "bg-foreground text-background" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {checked ? "✓" : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs opacity-70">
            Selected: {selected.size}
          </div>
        </div>
      )}
    </div>
  );
}
