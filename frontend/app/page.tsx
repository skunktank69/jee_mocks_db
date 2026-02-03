import SelectSubject from "#/components/sub-select";
import { JSX } from "react";

export default function Home(): JSX.Element {
  return (
    <main className="min-h-screen w-full flex items-center justify-center flex-col gap-20">
      <section className="text-center space-y-2 px-6">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
          Test your Knowledge
        </h1>

        <h2 className="text-2xl sm:text-4xl font-semibold text-amber-400">
          With ~15,000 JEE Main PYQs
        </h2>
      </section>
      <SelectSubject />
    </main>
  );
}
