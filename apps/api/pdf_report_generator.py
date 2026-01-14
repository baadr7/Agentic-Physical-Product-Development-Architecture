"""
pdf_report_generator.py
PDF report generation with WeasyPrint for DfX analysis deliverables.
Generates comprehensive reports with Executive Summary, DfX Analysis, Metrics, Recommendations.
"""
import os
import io
from typing import Dict, Any, List, Optional
from datetime import datetime
from jinja2 import Template

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False
    HTML = None
    CSS = None


def _pdf_escape_text(value: str) -> str:
    # Escape characters significant in PDF literal strings.
    return (
        value.replace('\\', '\\\\')
        .replace('(', '\\(')
        .replace(')', '\\)')
        .replace('\r', ' ')
        .replace('\n', ' ')
    )


def _build_minimal_text_pdf(title: str, lines: List[str]) -> bytes:
    """Build a minimal one-page PDF with visible text, without external deps.

    This is a fallback used when WeasyPrint cannot run (common on Windows without
    native GTK/Pango). It uses the built-in Helvetica Type1 font.
    """
    # A4 portrait in points.
    width, height = 595, 842
    x0, y0 = 50, 800
    leading = 14

    safe_lines: List[str] = [title, ""] + [str(x) for x in lines]
    # Keep PDFs reasonably small.
    safe_lines = [s[:220] for s in safe_lines][:80]

    parts: List[str] = ["BT", "/F1 12 Tf", f"{x0} {y0} Td"]
    for line in safe_lines:
        parts.append(f"({_pdf_escape_text(line)}) Tj")
        parts.append(f"0 -{leading} Td")
    parts.append("ET")
    stream = "\n".join(parts).encode('utf-8')

    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0]  # object 0

    def write_obj(obj_num: int, data: bytes):
        offsets.append(buf.tell())
        buf.write(f"{obj_num} 0 obj\n".encode('ascii'))
        buf.write(data)
        if not data.endswith(b"\n"):
            buf.write(b"\n")
        buf.write(b"endobj\n")

    write_obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    write_obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    page_obj = (
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] "
        f"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
    ).encode('ascii')
    write_obj(3, page_obj)
    write_obj(4, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    content_obj = b"<< /Length " + str(len(stream)).encode('ascii') + b" >>\nstream\n" + stream + b"\nendstream"
    write_obj(5, content_obj)

    xref_pos = buf.tell()
    buf.write(b"xref\n")
    buf.write(f"0 {len(offsets)}\n".encode('ascii'))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode('ascii'))
    buf.write(b"trailer\n")
    buf.write(f"<< /Size {len(offsets)} /Root 1 0 R >>\n".encode('ascii'))
    buf.write(b"startxref\n")
    buf.write(f"{xref_pos}\n".encode('ascii'))
    buf.write(b"%%EOF")
    return buf.getvalue()


# HTML template for PDF report (Jinja2)
PDF_REPORT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DfX Report - {{ variant_id }}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10pt;
                color: #666;
            }
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            color: #1a1a1a;
            font-size: 24pt;
            margin-bottom: 0.5em;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 0.3em;
        }
        h2 {
            color: #0066cc;
            font-size: 18pt;
            margin-top: 1.5em;
            margin-bottom: 0.8em;
            border-bottom: 1px solid #ccc;
            padding-bottom: 0.2em;
        }
        h3 {
            color: #333;
            font-size: 14pt;
            margin-top: 1em;
            margin-bottom: 0.5em;
        }
        .header {
            text-align: center;
            margin-bottom: 2em;
        }
        .logo {
            font-size: 28pt;
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 0.5em;
        }
        .metadata {
            background-color: #f5f5f5;
            padding: 1em;
            border-radius: 5px;
            margin-bottom: 2em;
        }
        .metadata table {
            width: 100%;
            border-collapse: collapse;
        }
        .metadata td {
            padding: 0.3em 0.5em;
            border-bottom: 1px solid #ddd;
        }
        .metadata td:first-child {
            font-weight: bold;
            width: 30%;
        }
        .score-card {
            background-color: #e8f4f8;
            padding: 1em;
            border-left: 5px solid #0066cc;
            margin: 1em 0;
            border-radius: 3px;
        }
        .score-value {
            font-size: 36pt;
            font-weight: bold;
            color: #0066cc;
            text-align: center;
            margin: 0.5em 0;
        }
        .metrics-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        .metrics-table th {
            background-color: #0066cc;
            color: white;
            padding: 0.5em;
            text-align: left;
        }
        .metrics-table td {
            padding: 0.5em;
            border-bottom: 1px solid #ddd;
        }
        .metrics-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .severity-high {
            color: #d32f2f;
            font-weight: bold;
        }
        .severity-medium {
            color: #f57c00;
            font-weight: bold;
        }
        .severity-low {
            color: #388e3c;
        }
        .recommendation {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 1em;
            margin: 0.5em 0;
            border-radius: 3px;
        }
        .risk-flag {
            background-color: #ffebee;
            border-left: 4px solid #d32f2f;
            padding: 1em;
            margin: 0.5em 0;
            border-radius: 3px;
        }
        .image-container {
            text-align: center;
            margin: 1em 0;
        }
        .image-container img {
            max-width: 80%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .footer {
            margin-top: 3em;
            padding-top: 1em;
            border-top: 1px solid #ccc;
            font-size: 9pt;
            color: #666;
            text-align: center;
        }
        .page-break {
            page-break-after: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">GenerativeCAD AI</div>
        <h1>DfX Analysis Report</h1>
        <p style="color: #666;">Generated on {{ generation_date }}</p>
    </div>

    <div class="metadata">
        <table>
            <tr>
                <td>Run ID:</td>
                <td>{{ run_id }}</td>
            </tr>
            <tr>
                <td>Variant ID:</td>
                <td>{{ variant_id }}</td>
            </tr>
            <tr>
                <td>Product Type:</td>
                <td>{{ product_type }}</td>
            </tr>
            <tr>
                <td>Material:</td>
                <td>{{ material }}</td>
            </tr>
            {% if mlflow_run_id %}
            <tr>
                <td>MLflow Run:</td>
                <td>{{ mlflow_run_id }}</td>
            </tr>
            {% endif %}
        </table>
    </div>

    <h2>Executive Summary</h2>
    <div class="score-card">
        <p style="text-align: center; margin: 0; font-size: 14pt; color: #666;">Overall DfX Score</p>
        <div class="score-value">{{ overall_score | round(2) }}</div>
        <p style="text-align: center; margin: 0; color: #666;">Out of 10.0</p>
    </div>

    <p>{{ executive_summary }}</p>

    {% if risk_flags %}
    <h3>Risk Flags</h3>
    {% for flag in risk_flags %}
    <div class="risk-flag">
        <strong>⚠ {{ flag.title }}</strong><br>
        {{ flag.description }}
    </div>
    {% endfor %}
    {% endif %}

    <div class="page-break"></div>

    <h2>DfX Analysis</h2>
    
    <h3>Fabricability</h3>
    <table class="metrics-table">
        <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Score</th>
        </tr>
        <tr>
            <td>Fabricability Score</td>
            <td>{{ metrics.fabricability_score | round(2) }}</td>
            <td>{{ metrics.fabricability_score | round(2) }} / 10</td>
        </tr>
        <tr>
            <td>Support Volume Ratio</td>
            <td>{{ metrics.support_volume_ratio | round(3) }}</td>
            <td>{% if metrics.support_volume_ratio < 0.2 %}<span class="severity-low">Good</span>{% elif metrics.support_volume_ratio < 0.4 %}<span class="severity-medium">Moderate</span>{% else %}<span class="severity-high">High</span>{% endif %}</td>
        </tr>
        <tr>
            <td>Build Time</td>
            <td>{{ metrics.build_time_minutes | round(0) }} min</td>
            <td>-</td>
        </tr>
    </table>

    <h3>Assemblability</h3>
    <table class="metrics-table">
        <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Score</th>
        </tr>
        <tr>
            <td>Assemblability Score</td>
            <td>{{ metrics.assemblability_score | round(2) }}</td>
            <td>{{ metrics.assemblability_score | round(2) }} / 10</td>
        </tr>
        <tr>
            <td>Part Count</td>
            <td>{{ metrics.part_count }}</td>
            <td>{% if metrics.part_count <= 5 %}<span class="severity-low">Low</span>{% elif metrics.part_count <= 15 %}<span class="severity-medium">Moderate</span>{% else %}<span class="severity-high">High</span>{% endif %}</td>
        </tr>
    </table>

    <h3>Sustainability</h3>
    <table class="metrics-table">
        <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Score</th>
        </tr>
        <tr>
            <td>Sustainability Score</td>
            <td>{{ metrics.sustainability_score | round(2) }}</td>
            <td>{{ metrics.sustainability_score | round(2) }} / 10</td>
        </tr>
        <tr>
            <td>Material Mass</td>
            <td>{{ metrics.mass_kg | round(3) }} kg</td>
            <td>-</td>
        </tr>
        {% if metrics.carbon_footprint %}
        <tr>
            <td>Carbon Footprint</td>
            <td>{{ metrics.carbon_footprint | round(2) }} kg CO2</td>
            <td>-</td>
        </tr>
        {% endif %}
    </table>

    <h3>Structural Performance</h3>
    <table class="metrics-table">
        <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Status</th>
        </tr>
        <tr>
            <td>Max von Mises Stress</td>
            <td>{{ metrics.max_von_mises_mpa | round(2) }} MPa</td>
            <td>{% if metrics.safety_factor and metrics.safety_factor >= 2.0 %}<span class="severity-low">Safe</span>{% elif metrics.safety_factor and metrics.safety_factor >= 1.5 %}<span class="severity-medium">Adequate</span>{% else %}<span class="severity-high">Critical</span>{% endif %}</td>
        </tr>
        <tr>
            <td>Max Deflection</td>
            <td>{{ metrics.max_deflection_mm | round(3) }} mm</td>
            <td>-</td>
        </tr>
        {% if metrics.safety_factor %}
        <tr>
            <td>Safety Factor</td>
            <td>{{ metrics.safety_factor | round(2) }}</td>
            <td>{% if metrics.safety_factor >= 2.0 %}<span class="severity-low">Good</span>{% elif metrics.safety_factor >= 1.5 %}<span class="severity-medium">Acceptable</span>{% else %}<span class="severity-high">Insufficient</span>{% endif %}</td>
        </tr>
        {% endif %}
    </table>

    <h3>Aesthetic Quality</h3>
    <table class="metrics-table">
        <tr>
            <th>Metric</th>
            <th>Value</th>
        </tr>
        <tr>
            <td>Aesthetic Score</td>
            <td>{{ metrics.aesthetic_score | round(2) }} / 10</td>
        </tr>
        <tr>
            <td>Surface Smoothness</td>
            <td>{{ metrics.smoothness_score | round(2) }}</td>
        </tr>
    </table>

    {% if images %}
    <div class="page-break"></div>
    <h2>Visual Assets</h2>
    {% for img in images %}
    <div class="image-container">
        <img src="{{ img.url }}" alt="{{ img.caption }}">
        <p style="color: #666; font-size: 10pt; margin-top: 0.5em;">{{ img.caption }}</p>
    </div>
    {% endfor %}
    {% endif %}

    <div class="page-break"></div>

    <h2>Recommendations</h2>
    {% if recommendations %}
    {% for rec in recommendations %}
    <div class="recommendation">
        <strong>{{ rec.title }}</strong><br>
        {{ rec.description }}
        {% if rec.severity %}
        <br><em class="severity-{{ rec.severity }}">Priority: {{ rec.severity | upper }}</em>
        {% endif %}
    </div>
    {% endfor %}
    {% else %}
    <p>No specific recommendations at this time. All metrics are within acceptable ranges.</p>
    {% endif %}

    <h2>User Feedback History</h2>
    {% if feedback_history %}
    <table class="metrics-table">
        <tr>
            <th>Date</th>
            <th>Rating</th>
            <th>Comment</th>
        </tr>
        {% for fb in feedback_history %}
        <tr>
            <td>{{ fb.created_at[:10] }}</td>
            <td>{{ fb.rating }}/10</td>
            <td>{{ fb.comment or '-' }}</td>
        </tr>
        {% endfor %}
    </table>
    {% else %}
    <p>No feedback recorded yet.</p>
    {% endif %}

    <h2>Scoring Weights Evolution</h2>
    {% if weights_history %}
    <table class="metrics-table">
        <tr>
            <th>Run</th>
            <th>Fabricability</th>
            <th>Assemblability</th>
            <th>Sustainability</th>
            <th>Aesthetic</th>
        </tr>
        {% for wh in weights_history %}
        <tr>
            <td>{{ wh.run_id[:8] }}</td>
            <td>{{ wh.new_weights.fabricability | round(2) }}</td>
            <td>{{ wh.new_weights.assemblability | round(2) }}</td>
            <td>{{ wh.new_weights.sustainability | round(2) }}</td>
            <td>{{ wh.new_weights.aesthetic | round(2) }}</td>
        </tr>
        {% endfor %}
    </table>
    {% else %}
    <p>Weights have not been adjusted from defaults.</p>
    {% endif %}

    <div class="footer">
        <p>This report was automatically generated by GenerativeCAD AI Platform.</p>
        <p>For questions or support, contact: support@generativecad.ai</p>
        <p style="font-size: 8pt; color: #999;">Report ID: {{ variant_id }} | Generation Date: {{ generation_date }}</p>
    </div>
</body>
</html>
"""


def generate_pdf_report(
    run_id: str,
    variant_id: str,
    variant_data: Dict[str, Any],
    dfx_summary: Dict[str, Any],
    metrics: Dict[str, Any],
    feedback_history: List[Dict[str, Any]],
    weights_history: List[Dict[str, Any]],
    images: Optional[List[Dict[str, str]]] = None,
    language: str = "en"
) -> bytes:
    """
    Generate PDF report for a variant using WeasyPrint.
    
    Args:
        run_id: Run identifier
        variant_id: Variant identifier
        variant_data: Variant record from DB
        dfx_summary: DfX summary record
        metrics: Computed metrics dict
        feedback_history: List of feedback records
        weights_history: List of weights history records
        images: Optional list of image dicts with 'url' and 'caption'
        language: Report language ('en' or 'fr')
    
    Returns:
        PDF bytes
    
    Raises:
        Exception if WeasyPrint not available or generation fails
    """
    if not WEASYPRINT_AVAILABLE:
        raise Exception("WeasyPrint not installed. Install with: pip install WeasyPrint==60.2")
    
    # Prepare template context
    context = {
        "run_id": run_id,
        "variant_id": variant_id,
        "generation_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "product_type": variant_data.get("product_type", "Unknown"),
        "material": variant_data.get("material", "Unknown"),
        "mlflow_run_id": variant_data.get("mlflow_run_id"),
        "overall_score": metrics.get("overall_score", 0.0),
        "metrics": {
            "fabricability_score": metrics.get("fabricability_score", 0.0),
            "assemblability_score": metrics.get("assemblability_score", 0.0),
            "sustainability_score": metrics.get("sustainability_score", 0.0),
            "aesthetic_score": metrics.get("aesthetic_score", 0.0),
            "support_volume_ratio": metrics.get("support_volume_ratio", 0.0),
            "build_time_minutes": metrics.get("build_time_minutes", 0),
            "part_count": metrics.get("part_count", 1),
            "mass_kg": metrics.get("mass_kg", 0.0),
            "carbon_footprint": metrics.get("carbon_footprint"),
            "max_von_mises_mpa": metrics.get("max_von_mises_mpa", 0.0),
            "max_deflection_mm": metrics.get("max_deflection_mm", 0.0),
            "safety_factor": metrics.get("safety_factor"),
            "smoothness_score": metrics.get("smoothness_score", 5.0)
        },
        "executive_summary": dfx_summary.get("summary", "No summary available."),
        "risk_flags": [],
        "recommendations": [],
        "feedback_history": feedback_history[-10:],  # Last 10 feedback entries
        "weights_history": weights_history[-5:],  # Last 5 weight changes
        "images": images or []
    }
    
    # Generate risk flags
    if metrics.get("safety_factor") and metrics["safety_factor"] < 1.5:
        context["risk_flags"].append({
            "title": "Low Safety Factor",
            "description": f"Safety factor of {metrics['safety_factor']:.2f} is below recommended minimum of 1.5. Consider increasing material strength or reducing load."
        })
    
    if metrics.get("support_volume_ratio", 0) > 0.4:
        context["risk_flags"].append({
            "title": "High Support Volume",
            "description": f"Support material ratio of {metrics['support_volume_ratio']:.2%} may increase cost and post-processing time."
        })
    
    if metrics.get("part_count", 1) > 15:
        context["risk_flags"].append({
            "title": "High Part Count",
            "description": f"Design contains {metrics['part_count']} parts, which may complicate assembly. Consider consolidation."
        })
    
    # Generate recommendations from DfX summary
    if dfx_summary.get("recommendations"):
        for rec_text in dfx_summary["recommendations"]:
            context["recommendations"].append({
                "title": "Design Improvement",
                "description": rec_text,
                "severity": "medium"
            })
    
    # Add default recommendations based on metrics
    if metrics.get("fabricability_score", 0) < 6.0:
        context["recommendations"].append({
            "title": "Improve Fabricability",
            "description": "Consider reducing overhang angles, minimizing support structures, and ensuring minimum wall thickness > 1mm.",
            "severity": "high"
        })
    
    if metrics.get("sustainability_score", 0) < 5.0:
        context["recommendations"].append({
            "title": "Enhance Sustainability",
            "description": "Reduce material usage through topology optimization or hollow internal structures. Consider recyclable materials.",
            "severity": "low"
        })
    
    # Render HTML from template
    template = Template(PDF_REPORT_TEMPLATE)
    html_content = template.render(**context)
    
    # Generate PDF with WeasyPrint
    try:
        pdf_bytes = HTML(string=html_content).write_pdf()
        return pdf_bytes
    except Exception as e:
        raise Exception(f"PDF generation failed: {e}")


def generate_pdf_report_simple(
    variant_id: str,
    overall_score: float,
    metrics: Dict[str, Any],
    variants: Optional[List[Dict[str, Any]]] = None,
    prompts: Optional[List[str]] = None,
) -> bytes:
    """
    Simplified PDF generation for testing/fallback.
    
    Returns:
        PDF bytes with basic metrics table
    """
    # WeasyPrint is preferred, but on Windows it often fails at runtime due to
    # missing native libraries. In that case we fall back to a minimal PDF.
    
    def _html_escape(v: Any) -> str:
        s = '' if v is None else str(v)
        return (
            s.replace('&', '&amp;')
             .replace('<', '&lt;')
             .replace('>', '&gt;')
             .replace('"', '&quot;')
             .replace("'", '&#39;')
        )

    variants = variants or []
    prompts = prompts or []

    variants_rows = "".join(
        "<tr>"
        f"<td>{_html_escape(v.get('id') or v.get('variant_id') or '')}</td>"
        f"<td>{_html_escape(v.get('score') or '')}</td>"
        f"<td>{_html_escape((v.get('metrics') or {}).get('mass_g') if isinstance(v.get('metrics'), dict) else v.get('mass_g'))}</td>"
        f"<td>{_html_escape((v.get('metrics') or {}).get('volume_cm3') if isinstance(v.get('metrics'), dict) else v.get('volume_cm3'))}</td>"
        f"<td>{_html_escape((v.get('metrics') or {}).get('safety_factor') if isinstance(v.get('metrics'), dict) else v.get('safety_factor'))}</td>"
        "</tr>"
        for v in variants[:25]
    )

    prompts_html = "".join(f"<li>{_html_escape(p)}</li>" for p in prompts[:20])

    simple_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>DfX Report - {variant_id}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 2cm; }}
            h1 {{ color: #0066cc; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 1em; }}
            th {{ background-color: #0066cc; color: white; padding: 0.5em; text-align: left; }}
            td {{ padding: 0.5em; border-bottom: 1px solid #ddd; }}
            ul {{ margin-top: 0.5em; }}
        </style>
    </head>
    <body>
        <h1>DfX Report</h1>
        <p><strong>Variant ID:</strong> {variant_id}</p>
        <p><strong>Overall Score:</strong> {overall_score:.2f} / 10</p>
        
        <h2>Metrics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            {''.join(f'<tr><td>{k}</td><td>{v}</td></tr>' for k, v in metrics.items())}
        </table>

        <h2>Variants</h2>
        <p>Total variants: {len(variants)}</p>
        <table>
            <tr><th>Variant</th><th>Score</th><th>Mass (g)</th><th>Volume (cm³)</th><th>Safety factor</th></tr>
            {variants_rows or '<tr><td colspan="5">No variants available</td></tr>'}
        </table>

        <h2>Prompts</h2>
        {('<ul>' + prompts_html + '</ul>') if prompts_html else '<p>No prompts available</p>'}
        
        <p style="margin-top: 2em; color: #666; font-size: 10pt;">
            Generated by GenerativeCAD AI Platform
        </p>
    </body>
    </html>
    """
    
    if WEASYPRINT_AVAILABLE and HTML is not None:
        try:
            return HTML(string=simple_html).write_pdf()
        except Exception:
            # Fall through to pure-Python PDF
            pass

    # Fallback: readable PDF with key-value lines (always non-empty)
    report_text = metrics.get('report') or metrics.get('summary') or ''
    report_lines = []
    if isinstance(report_text, str) and report_text.strip():
        report_lines.extend(report_text.strip().splitlines()[:40])

    kv_lines = [
        f"Variant/Run ID: {variant_id}",
        f"Overall Score: {overall_score:.2f} / 10",
        "",
        "Metrics:",
    ]
    for k, v in (metrics or {}).items():
        if k in ('report', 'summary'):
            continue
        kv_lines.append(f"- {k}: {v}")
    if report_lines:
        kv_lines.extend(["", "DfX Summary:"] + report_lines)

    # Add variants summary
    kv_lines.extend(["", f"Variants ({len(variants or [])}):"])
    for v in (variants or [])[:25]:
        vm = v.get('metrics') if isinstance(v.get('metrics'), dict) else {}
        kv_lines.append(
            f"- {v.get('id') or v.get('variant_id') or ''}: score={v.get('score')}, mass_g={vm.get('mass_g') if isinstance(vm, dict) else v.get('mass_g')}, volume_cm3={vm.get('volume_cm3') if isinstance(vm, dict) else v.get('volume_cm3')}, safety_factor={vm.get('safety_factor') if isinstance(vm, dict) else v.get('safety_factor')}"
        )

    # Add prompts
    if prompts:
        kv_lines.extend(["", f"Prompts ({len(prompts)}):"])
        for p in prompts[:20]:
            kv_lines.append(f"- {p}")
    kv_lines.append("")
    kv_lines.append("Generated by Makerkit (fallback PDF mode)")

    return _build_minimal_text_pdf("DfX Report", kv_lines)
