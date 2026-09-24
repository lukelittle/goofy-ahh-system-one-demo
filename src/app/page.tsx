import Demo from "@/components/Demo";
import Education from "@/components/Education";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
      <header className="pt-10 pb-6 sm:pt-14">
        <h1 className="meme text-4xl sm:text-6xl">Goofy Ahh System One Demo</h1>
        <p className="mt-4 text-lg sm:text-xl">Teaching serious AI concepts with extremely unserious classification problems.</p>
        <p className="mt-2 text-neutral-600">
          Upload a PFP. A System One vision model will make an unnecessarily sophisticated probabilistic judgment about your internet archetype.
        </p>
      </header>

      <Demo />

      <p className="mt-4 text-sm text-neutral-500">
        Classifies the visual presentation of an image into four joke categories, straight from the &ldquo;4 types of IT guys&rdquo; meme. It says nothing about anyone&apos;s identity. Images go to
        the configured Circuit endpoint and are not stored by this app.
      </p>

      <hr className="my-16 border-t-4 border-black" />

      <Education />

      <footer className="mt-20 border-t border-neutral-300 pt-6 text-sm text-neutral-500">
        Runs on{" "}
        <a className="underline" href="https://huggingface.co/jbarney/circuit-vl-4b">
          jbarney/circuit-vl-4b
        </a>{" "}
        via the{" "}
        <a className="underline" href="https://github.com/Barneyjm/decision-circuits">
          decision-circuits
        </a>{" "}
        System One contract. Not affiliated with the model&apos;s author.
      </footer>
    </main>
  );
}
