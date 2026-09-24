export default function MockBanner() {
  return (
    <div className="bg-[repeating-linear-gradient(45deg,#facc15,#facc15_12px,#1f2937_12px,#1f2937_24px)] p-1">
      <p className="bg-black px-4 py-2 text-center text-sm font-bold uppercase tracking-wider text-yellow-300">
        Mock mode (CIRCUIT_MOCK=1): these numbers are a hash of the image, NOT Circuit-VL output
      </p>
    </div>
  );
}
