export default function MockBanner() {
  return (
    <p className="border-4 border-red-600 bg-red-50 px-4 py-2 text-center font-bold text-red-700">
      MOCK MODE (CIRCUIT_MOCK=1): these numbers are a hash of the image, NOT Circuit-VL output.
    </p>
  );
}
