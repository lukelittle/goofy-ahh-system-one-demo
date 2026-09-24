import Demo from "@/components/Demo";
import Education from "@/components/Education";
import Mascot from "@/components/Mascot";

// Optional: a hero image you have the rights to, placed in public/ (see README, "Visual identity").
const heroImage = process.env.NEXT_PUBLIC_HERO_IMAGE;

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <section className="grid items-center gap-10 pt-14 pb-12 md:grid-cols-[1fr_auto] md:pt-20">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-violet-300">A bounded-decision demo on Circuit-VL</p>
          <h1 className="font-display mt-4 text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl">
            <span className="goofy-wobble text-yellow-300">Goofy Ahh</span>
            <br />
            System One Demo
          </h1>
          <p className="mt-6 text-xl text-slate-200">Teaching serious AI concepts with extremely unserious classification problems.</p>
          <p className="mt-3 max-w-2xl text-slate-400">
            Upload a PFP. A System One vision model will make an unnecessarily sophisticated probabilistic judgment about your internet archetype.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["one forward pass", "zero generated tokens", "four supplied options", "one probability each"].map((t) => (
              <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-slate-300">
                {t}
              </span>
            ))}
          </div>
        </div>
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- a developer-supplied file in public/
          <img src={heroImage} alt="Hero image" className="goofy-bob mx-auto h-52 w-52 rounded-full object-cover ring-6 ring-yellow-300 sm:h-64 sm:w-64" />
        ) : (
          <Mascot className="goofy-bob mx-auto h-52 w-52 drop-shadow-[0_20px_40px_rgba(124,58,237,0.45)] sm:h-64 sm:w-64" />
        )}
      </section>

      <section aria-label="Demo" className="pb-20">
        <Demo />
        <p className="mt-6 text-xs text-slate-500">
          Classifies the visual presentation of an image into four joke categories. It makes no claim about anyone&apos;s identity. Images are sent to the configured Circuit endpoint and are not
          stored by this app.
        </p>
      </section>

      <Education />

      <footer className="mt-24 border-t border-white/10 pt-8 text-sm text-slate-500">
        Built on{" "}
        <a className="underline" href="https://huggingface.co/jbarney/circuit-vl-4b">
          jbarney/circuit-vl-4b
        </a>{" "}
        and the{" "}
        <a className="underline" href="https://github.com/Barneyjm/decision-circuits">
          decision-circuits
        </a>{" "}
        System One contract. The mascot is original and not a real person. Not affiliated with the model author.
      </footer>
    </main>
  );
}
