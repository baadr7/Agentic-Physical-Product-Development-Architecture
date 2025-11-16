from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_pdf_report_inline():
    # No dependency on reportlab or storage: endpoint should still return a PDF
    res = client.get('/api/v1/runs/run-demo/report.pdf')
    assert res.status_code == 200
    assert res.headers.get('content-type', '').startswith('application/pdf')
    assert len(res.content) > 20
