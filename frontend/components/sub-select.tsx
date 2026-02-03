import Link from "next/link";
import { cn } from "#/lib/utils";
import { Atom, Calculator, FlaskConicalIcon } from "lucide-react";

type Card = {
  title: string;
  chapters: string;
  href: string;
  tone: "chem" | "phy" | "math";
  Icon: React.ComponentType<{ className?: string }>;
};

const cards: Card[] = [
  {
    title: "Chemistry",
    chapters: "38 Chapters",
    href: "/subject/chemistry",
    tone: "chem",
    Icon: FlaskConicalIcon,
  },
  {
    title: "Physics",
    chapters: "39 Chapters",
    href: "/subject/physics",
    tone: "phy",
    Icon: Atom,
  },
  {
    title: "Mathematics",
    chapters: "34 Chapters",
    href: "/subject/mathematics",
    tone: "math",
    Icon: Calculator,
  },
];

const toneVars: Record<Card["tone"], React.CSSProperties> = {
  chem: {
    ["--tone" as any]: "oklch(0.73 0.2 145)",
  },
  phy: {
    ["--tone" as any]: "oklch(0.65 0.22 305)",
  },
  math: {
    ["--tone" as any]: "oklch(0.65 0.23 25)",
  },
};

export default function SelectSubject(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 p-2 md:p-0">
        {cards.map(({ title, chapters, href, Icon, tone }) => (
          <Link
            key={href}
            href={href}
            style={toneVars[tone]}
            className={cn(
              "group rounded-3xl p-[2px] ",
              "transition-transform duration-300 ease-out hover:-translate-y-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <div
              className={cn(
                "relative isolate overflow-hidden rounded-3xl",
                "border-4 border-border bg-card",
                "min-h-[220px] md:min-h-[260px]",
                "transition-colors duration-300 group-hover:border-[color:var(--tone)]",
              )}
            >
              {/* background icon */}
              <Icon
                className={cn(
                  "pointer-events-none absolute",
                  "-right-10 -bottom-14",
                  "h-48 w-48",
                  "z-0",
                  "text-muted-foreground",
                  "-rotate-45",
                  "transition-transform duration-300 ease-out opacity-10",
                  "group-hover:scale-110 group-hover:rotate-0",
                  "group-hover:text-[color:var(--tone)] group-hover:opacity-40",
                )}
              />

              {/* content */}
              <div className="relative z-10 p-8 space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground">{chapters}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
