// Stub ligero para dependencias opcionales de jsPDF (html2canvas / canvg)
// que no se usan en receiptPdfGenerator.js (generación vectorial pura).
export default function emptyOptionalDep() {
  return Promise.resolve(null);
}
export class Canvg {
  static from() {
    return Promise.resolve({ render: () => Promise.resolve() });
  }
}
