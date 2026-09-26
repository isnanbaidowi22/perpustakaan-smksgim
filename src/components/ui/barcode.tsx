import { code128Bars } from '@/lib/code128';

/** Tinggi relatif di viewBox; tinggi sebenarnya diatur lewat `className`. */
const HEIGHT = 40;

/**
 * Barcode Code128 sebagai SVG. `preserveAspectRatio="none"` membiarkan
 * `className` menentukan ukuran cetaknya dalam mm; `crispEdges` menjaga
 * tepi bar tetap tajam di printer thermal dan laser.
 */
export function Barcode({
  value, className, moduleMm,
}: { value: string; className?: string; moduleMm?: number }) {
  const encoded = code128Bars(value);
  if (!encoded) {
    return (
      <span role="img" aria-label={`Barcode ${value} tidak dapat dicetak`} className={className}>
        <span className="block font-mono font-semibold">{value}</span>
        <span className="block text-[7pt]">Tidak dapat dicetak sebagai barcode: gunakan huruf, angka, dan tanda baca biasa.</span>
      </span>
    );
  }
  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      viewBox={`0 0 ${encoded.totalModules} ${HEIGHT}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
      style={moduleMm ? { width: `${encoded.totalModules * moduleMm}mm` } : undefined}
    >
      <rect x={0} y={0} width={encoded.totalModules} height={HEIGHT} fill="#fff" />
      {encoded.bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={HEIGHT} fill="#000" />
      ))}
    </svg>
  );
}
