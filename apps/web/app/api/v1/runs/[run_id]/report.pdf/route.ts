import { NextRequest } from 'next/server';

// Minimal PDF bytes: %PDF-1.4 with one page and dummy content
function buildPdf(): Uint8Array {
  const pdf = `%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<< /Type /Catalog /Pages 3 0 R>>endobj\n3 0 obj<< /Type /Pages /Kids [4 0 R] /Count 1>>endobj\n4 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Contents 5 0 R>>endobj\n5 0 obj<< /Length 44>>stream\nBT /F1 12 Tf 50 150 Td (Rapport DfX Stub) Tj ET\nendstream\nendobj\n6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj\n7 0 obj<< /ProcSet [/PDF /Text] /Font << /F1 6 0 R >> >>endobj\nxref\n0 8\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000104 00000 n \n0000000159 00000 n \n0000000256 00000 n \n0000000360 00000 n \n0000000444 00000 n \ntrailer<< /Size 8 /Root 2 0 R >>\nstartxref\n520\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export async function GET(_: NextRequest, { params }: { params: { run_id: string } }) {
  const bytes = buildPdf();
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': bytes.length.toString(),
    },
  });
}
