from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent
PREVIEW = ROOT / "client-preview"
OUT = ROOT / "Vale-AI-Gateway-Demo.pdf"

BLUE = HexColor("#1d4ed8")
NAVY = HexColor("#0b1f3d")
MUTED = HexColor("#4a6280")
LINE = HexColor("#d4e2f2")
WASH = HexColor("#eef4fb")
RAISED = HexColor("#f3f7fd")

SHOTS = [
    ("01-login.png", "Sign-in", "Operator console login. The demonstration notice is shown before anyone enters the product."),
    ("02-overview.png", "Overview", "Live dashboard: request volume, savings, health strip and the request path."),
    ("03-playground.png", "Playground", "Frontend console for a live completion against the backend gateway."),
    ("04-requests.png", "Requests / traces", "Metadata-only request log. Prompt text and NHS numbers are not stored here."),
    ("05-privacy.png", "Privacy", "UK PII screening. If privacy cannot run, the provider is not contacted."),
    ("06-cache.png", "Cache lab", "Exact cache behaviour. Semantic cache is planned, not claimed as live."),
    ("07-organisations.png", "Organisations", "Tenant list. Each organisation has its own keys, budget and provider set."),
    ("13-create-app.png", "Create app", "Seven-step onboarding: details, providers, privacy, budget, API key, integration, test."),
    ("08-savings.png", "Savings", "Verified cache savings only. Planned routing savings are labelled as planned."),
    ("09-health.png", "Health", "Core services and AI providers. Missing keys show as not configured, not as healthy."),
    ("10-architecture.png", "Architecture", "The path a production request is designed to keep."),
    ("11-settings.png", "Settings", "Operator configuration for providers and secrets. Keys stay on the server."),
    ("12-engineering.png", "Engineering", "Internal notes on what is shipped versus what is still open."),
]


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle("cover_kicker", parent=base["Normal"], textColor=BLUE, fontName="Helvetica-Bold", fontSize=11, tracking=1, alignment=TA_CENTER),
        "cover_title": ParagraphStyle("cover_title", parent=base["Title"], textColor=NAVY, fontName="Helvetica-Bold", fontSize=28, leading=34, alignment=TA_CENTER, spaceAfter=10),
        "cover_sub": ParagraphStyle("cover_sub", parent=base["Normal"], textColor=MUTED, fontSize=12, leading=18, alignment=TA_CENTER),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], textColor=NAVY, fontName="Helvetica-Bold", fontSize=18, leading=22, spaceBefore=4, spaceAfter=10),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], textColor=BLUE, fontName="Helvetica-Bold", fontSize=13, leading=17, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("body", parent=base["Normal"], textColor=NAVY, fontSize=10.5, leading=15, alignment=TA_JUSTIFY, spaceAfter=8),
        "bullet": ParagraphStyle("bullet", parent=base["Normal"], textColor=NAVY, fontSize=10.5, leading=15),
        "caption": ParagraphStyle("caption", parent=base["Normal"], textColor=MUTED, fontSize=9.5, leading=13, spaceBefore=4, spaceAfter=12),
        "warn": ParagraphStyle("warn", parent=base["Normal"], textColor=NAVY, fontSize=11, leading=16, alignment=TA_LEFT),
        "footer": ParagraphStyle("footer", parent=base["Normal"], textColor=MUTED, fontSize=8, alignment=TA_CENTER),
        "small": ParagraphStyle("small", parent=base["Normal"], textColor=MUTED, fontSize=9, leading=12),
    }


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(WASH)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1] - 8, A4[0], 8, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 10 * mm, "Vale AI Gateway  |  Demonstration brief  |  Not a finished product")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def shot(path: Path, caption: str, sty) -> list:
    if not path.exists():
        return [Paragraph(f"Screenshot missing: {path.name}", sty["caption"])]
    width = 170 * mm
    img = Image(str(path))
    img.drawWidth = width
    img.drawHeight = width * (img.imageHeight / img.imageWidth)
    max_h = 150 * mm
    if img.drawHeight > max_h:
        scale = max_h / img.drawHeight
        img.drawWidth *= scale
        img.drawHeight *= scale
    return [img, Paragraph(caption, sty["caption"])]


def bullets(items, sty):
    return ListFlowable(
        [ListItem(Paragraph(item, sty["bullet"]), leftIndent=12) for item in items],
        bulletType="bullet",
        leftIndent=16,
        spaceAfter=10,
    )


def build():
    sty = styles()
    story = []

    story.append(Spacer(1, 38 * mm))
    story.append(Paragraph("CLIENT PREVIEW", sty["cover_kicker"]))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Vale AI Gateway", sty["cover_title"]))
    story.append(Paragraph(
        "A demonstration of a multi-tenant AI cost and privacy gateway.<br/>Blue and white operator console. Live HTTPS preview.",
        sty["cover_sub"],
    ))
    story.append(Spacer(1, 12 * mm))
    notice = [
        [Paragraph(
            "<b>Please read this first.</b><br/><br/>"
            "This is a demonstration. A working slice of the platform is live so you can click through the console and see the request path. "
            "A large amount of product work is still remaining. Treat this as a preview, not a finished commercial platform, and do not plan go-live dates from this build alone.",
            sty["warn"],
        )]
    ]
    table = Table(notice, colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#dbe7ff")),
        ("BOX", (0, 0), (-1, -1), 0.6, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(table)
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Live preview: https://vale.191-215-35-197.sslip.io", sty["cover_sub"]))
    story.append(Paragraph("Public source: see the GitHub repository README in this project.", sty["cover_sub"]))
    story.append(PageBreak())

    story.append(Paragraph("1. What this preview is", sty["h1"]))
    story.append(Paragraph(
        "Vale sits between a client application and model providers (OpenAI, Anthropic, Google). "
        "An organisation API key authenticates the caller. The gateway checks budget, screens UK personal data, "
        "looks up an exact cache entry, and only then calls a configured provider with a masked prompt. "
        "Restored text is returned to the caller.",
        sty["body"],
    ))
    story.append(Paragraph(
        "The screenshots in this document are from the current blue-and-white console. "
        "They show the product as it exists today. Empty charts, unused providers and planned badges are honest empty states, not placeholders pretending to be live.",
        sty["body"],
    ))

    story.append(Paragraph("2. What is in the frontend", sty["h1"]))
    story.append(Paragraph(
        "The frontend is a Next.js operator console. It is not the public customer website. It is the control room for organisations, keys, spend, privacy and health.",
        sty["body"],
    ))
    story.append(bullets([
        "<b>Overview</b> — dashboard of request volume, savings and gateway status.",
        "<b>Playground</b> — send a live completion through the same backend path a client API would use.",
        "<b>Requests</b> — trace list and detail. Metadata only.",
        "<b>Privacy</b> — inspect how UK PII is detected and tokenised.",
        "<b>Cache lab</b> — exact cache behaviour. Semantic cache is not shipped.",
        "<b>Organisations / Create app</b> — tenant onboarding, keys, budget, provider selection.",
        "<b>Savings</b> — verified cache savings; routing savings marked planned.",
        "<b>Health</b> — Postgres, Redis, privacy engine, and each AI provider.",
        "<b>Architecture / Engineering / Settings</b> — system map, remaining work, operator configuration.",
    ], sty))

    story.append(Paragraph("3. What is happening in the backend", sty["h1"]))
    story.append(Paragraph(
        "HTTP routes in the API layer validate input and then hand off to services. Route handlers do not price a request, build a cache key, or mask text. "
        "A single orchestrator, GatewayService, runs each completion in this order:",
        sty["body"],
    ))
    story.append(bullets([
        "Authenticate the organisation API key (stored as a SHA-256 hash).",
        "Resolve the tenant and reject archived or revoked organisations.",
        "Enforce monthly budget, daily limit, per-request cap and spike guard.",
        "Detect UK personal data and tokenise it. If privacy cannot run, the provider is not called.",
        "Look up an exact cache entry in Redis when configured.",
        "Call OpenAI, Anthropic, Google or LiteLLM only if that provider is configured.",
        "Restore the original entities in the response.",
        "Write cost and savings to the ledger. Persist request metadata, not the prompt.",
    ], sty))
    story.append(Paragraph(
        "Postgres holds tenants, hashed keys, request metadata, the ledger and audit events. "
        "Redis holds the exact cache. The live VPS process is attached to those stores. "
        "Provider keys are not configured in this demonstration, so Health reports them as not configured rather than inventing a successful model call.",
        sty["body"],
    ))

    story.append(Paragraph("4. What the logs contain", sty["h1"]))
    story.append(Paragraph(
        "Every completion receives a request id. Structured logs and the Requests screen carry that id plus tenant, provider, latency, cache status and entity counts.",
        sty["body"],
    ))
    story.append(bullets([
        "<b>Written:</b> request id, tenant id, model, provider, latency, cache hit/miss, token/cost micros, entity counts, policy decisions.",
        "<b>Never written:</b> raw prompt text, restored prompt text, NHS numbers, API keys, provider credentials, placeholder maps.",
        "<b>Audit:</b> metadata-only events so a reviewer can see that a request happened without reading the user's words.",
        "<b>Console session:</b> httpOnly cookie, 12-hour life, Secure on HTTPS. Login is rate-limited.",
    ], sty))
    story.append(Paragraph(
        "If a future production environment adds CloudWatch or another log drain, the same rule applies: request id and operational fields only.",
        sty["body"],
    ))

    story.append(Paragraph("5. Done in this demonstration vs still remaining", sty["h1"]))
    story.append(Paragraph("Present in this build", sty["h2"]))
    story.append(bullets([
        "Operator sign-in and the blue/white console.",
        "Create App onboarding and organisation detail.",
        "External API: chat completions, models, usage, health.",
        "UK PII screening that fails closed.",
        "Exact Redis cache and a savings ledger in money micros.",
        "Health that distinguishes core services from unconfigured providers.",
        "HTTPS on the preview host.",
    ], sty))
    story.append(Paragraph("Still to be built — please keep this in view", sty["h2"]))
    story.append(bullets([
        "Semantic cache.",
        "Model-routing savings.",
        "Token-by-token provider streaming (today the stream is a lifecycle feed after the full restored response).",
        "Multi-user console roles (org admin / viewer types exist; only the operator can sign in).",
        "Provider credentials and a real customer domain.",
        "Billing, SSO, alerting, SLA, and the remaining commercial product surface.",
        "A substantial amount of design, hardening and feature work beyond this slice.",
    ], sty))

    story.append(PageBreak())
    story.append(Paragraph("6. Platform screenshots", sty["h1"]))
    story.append(Paragraph(
        "These captures are the current demonstration console. Read the demonstration notice on sign-in and in the sidebar on every page.",
        sty["body"],
    ))

    for filename, title, caption in SHOTS:
        story.append(KeepTogether([
            Paragraph(title, sty["h2"]),
            Paragraph(caption, sty["body"]),
            *shot(PREVIEW / filename, f"Figure — {title}", sty),
        ]))

    story.append(Paragraph("7. How to review", sty["h1"]))
    story.append(bullets([
        "Open the HTTPS preview URL. The browser should show a lock, not Not secure.",
        "Ask the project owner for the operator sign-in. Credentials are not published in this file.",
        "Walk Overview, Create app, Requests, Health and Architecture.",
        "Treat empty or planned areas as unfinished work, not defects in a finished product.",
        "The public GitHub README repeats this status in writing.",
    ], sty))
    story.append(Paragraph(
        "This document is a briefing for a client review of a demonstration. It is not a contract, a delivery certificate, or a claim that the platform is complete.",
        sty["body"],
    ))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Vale AI Gateway — Demonstration brief",
        author="Vale project",
        subject="Client demonstration of the Vale AI cost and privacy gateway",
    )
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUT)


if __name__ == "__main__":
    build()
