#!/usr/bin/env python3
"""
generate_site.py — Thunder Blessing GDD Documentation Site Generator
Run from the project root:  python docs/pages/generate_site.py

Converts every docs/*.md file into a matching HTML page under docs/pages/.
Uses Python stdlib only — no third-party markdown library required.
"""

import re
import sys
import html as html_module
from pathlib import Path
from urllib.parse import urlparse

# ── Configuration ──────────────────────────────────────────────────────────────

DOCS_DIR   = Path(__file__).parent.parent          # docs/
PAGES_DIR  = Path(__file__).parent                 # docs/pages/
INDEX_HREF = "index.html"

DARK_THEME = {
    "bg_primary":    "#0f1117",
    "bg_secondary":  "#161b27",
    "bg_tertiary":   "#1e2535",
    "bg_card":       "#1a2032",
    "border":        "#2a3347",
    "text_primary":  "#e2e8f0",
    "text_secondary":"#94a3b8",
    "text_muted":    "#64748b",
    "accent":        "#f6ad55",
    "accent_dim":    "#c27d30",
    "green":         "#4ade80",
    "blue":          "#60a5fa",
    "red":           "#f87171",
}

# Map filename stem → (display label, category, icon)
DOC_META = {
    "BRD":          ("BRD — Business Requirements",        "Business",    "📋"),
    "PRD":          ("PRD — Product Requirements",         "Business",    "📝"),
    "PDD":          ("PDD — Product Design",               "Design",      "🎨"),
    "VDD":          ("VDD — Video Design",                 "Design",      "🎬"),
    "EDD":          ("EDD — Engine Design",                "Engineering", "⚙️"),
    "ARCH":         ("ARCH — Architecture",                "Engineering", "🏗️"),
    "API":          ("API — REST API Reference",           "Engineering", "🔌"),
    "SCHEMA":       ("SCHEMA — Database Schema",           "Engineering", "🗄️"),
    "FRONTEND":     ("FRONTEND — Frontend Spec",           "Engineering", "🖥️"),
    "AUDIO":        ("AUDIO — Audio Design",               "Design",      "🔊"),
    "ANIM":         ("ANIM — Animation Spec",              "Design",      "✨"),
    "test-plan":    ("Test Plan — QA Strategy",            "Testing",     "🧪"),
    "RTM":          ("RTM — Traceability Matrix",          "Testing",     "📊"),
    "runbook":      ("Runbook — Production Ops",           "Operations",  "📟"),
    "LOCAL_DEPLOY": ("LOCAL_DEPLOY — Local Dev Setup",     "Operations",  "🚀"),
}


# ── CSS ────────────────────────────────────────────────────────────────────────

INLINE_CSS = """
    :root {
      --bg-primary:     #0f1117;
      --bg-secondary:   #161b27;
      --bg-tertiary:    #1e2535;
      --bg-card:        #1a2032;
      --border:         #2a3347;
      --text-primary:   #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted:     #64748b;
      --accent:         #f6ad55;
      --accent-dim:     #c27d30;
      --accent-glow:    rgba(246,173,85,0.15);
      --green:          #4ade80;
      --blue:           #60a5fa;
      --purple:         #a78bfa;
      --red:            #f87171;
      --sidebar-width:  260px;
      --header-height:  60px;
      --font-sans:      'Inter', system-ui, sans-serif;
      --font-mono:      'JetBrains Mono', 'Fira Code', monospace;
      --radius:         8px;
      --radius-lg:      12px;
      --duration-fast:  150ms;
      --ease-out:       cubic-bezier(0.16,1,0.3,1);
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .site-header {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--header-height);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
      z-index: 100;
    }

    .header-logo {
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--accent);
      text-decoration: none;
      white-space: nowrap;
    }

    .header-title {
      font-size: 0.85rem;
      color: var(--text-secondary);
      border-left: 1px solid var(--border);
      padding-left: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-back {
      margin-left: auto;
      font-size: 0.82rem;
      color: var(--text-secondary);
      text-decoration: none;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: all var(--duration-fast);
      white-space: nowrap;
    }

    .header-back:hover {
      color: var(--accent);
      border-color: var(--accent-dim);
      background: var(--accent-glow);
    }

    .menu-toggle {
      display: none;
      background: none;
      border: none;
      color: var(--text-primary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }

    .menu-toggle:hover { background: var(--bg-tertiary); }

    /* Layout */
    .layout {
      display: flex;
      margin-top: var(--header-height);
      min-height: calc(100vh - var(--header-height));
    }

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      position: fixed;
      top: var(--header-height);
      left: 0; bottom: 0;
      overflow-y: auto;
      padding: 20px 0;
      transition: transform var(--duration-fast) var(--ease-out);
      z-index: 90;
    }

    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .nav-section-label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      padding: 12px 20px 6px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 20px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.85rem;
      border-left: 2px solid transparent;
      transition: all var(--duration-fast);
    }

    .nav-link:hover {
      color: var(--text-primary);
      background: var(--accent-glow);
      border-left-color: var(--accent-dim);
    }

    .nav-link.active {
      color: var(--accent);
      background: var(--accent-glow);
      border-left-color: var(--accent);
      font-weight: 500;
    }

    /* Main content */
    .main {
      margin-left: var(--sidebar-width);
      flex: 1;
      padding: 40px 48px;
      max-width: 920px;
    }

    /* Page heading */
    .page-title {
      font-size: clamp(1.6rem, 2.5vw, 2rem);
      font-weight: 700;
      margin-bottom: 8px;
      line-height: 1.25;
    }

    .page-meta {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 32px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .page-meta span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Markdown content */
    .md-content h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 40px 0 16px;
      color: var(--text-primary);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .md-content h1:first-child { margin-top: 0; }

    .md-content h2 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 36px 0 14px;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .md-content h2::before {
      content: '';
      display: block;
      width: 3px;
      height: 16px;
      background: var(--accent);
      border-radius: 2px;
      flex-shrink: 0;
    }

    .md-content h3 {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 28px 0 10px;
      color: var(--text-primary);
    }

    .md-content h4 {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 20px 0 8px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.82rem;
    }

    .md-content p {
      margin-bottom: 14px;
      color: var(--text-secondary);
    }

    .md-content a {
      color: var(--accent);
      text-decoration: none;
    }

    .md-content a:hover { text-decoration: underline; }

    .md-content strong { color: var(--text-primary); font-weight: 600; }
    .md-content em     { color: var(--text-secondary); font-style: italic; }

    /* Inline code */
    .md-content code {
      font-family: var(--font-mono);
      font-size: 0.82em;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 5px;
      color: var(--accent);
    }

    /* Code blocks */
    .md-content pre {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px 20px;
      overflow-x: auto;
      margin: 16px 0;
    }

    .md-content pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.7;
    }

    /* Mermaid */
    .mermaid-wrap {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin: 16px 0;
      overflow-x: auto;
    }

    /* Tables */
    .table-wrap {
      overflow-x: auto;
      margin: 16px 0;
    }

    .md-content table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .md-content table th {
      text-align: left;
      padding: 8px 12px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
    }

    .md-content table td {
      padding: 9px 12px;
      border-bottom: 1px solid rgba(42,51,71,0.5);
      color: var(--text-secondary);
      vertical-align: top;
    }

    .md-content table tr:last-child td { border-bottom: none; }
    .md-content table tr:hover td { background: rgba(255,255,255,0.02); }

    /* Lists */
    .md-content ul, .md-content ol {
      padding-left: 20px;
      margin-bottom: 14px;
      color: var(--text-secondary);
    }

    .md-content li { margin-bottom: 5px; }
    .md-content li > ul, .md-content li > ol { margin-top: 5px; margin-bottom: 0; }

    /* Blockquotes */
    .md-content blockquote {
      border-left: 3px solid var(--accent-dim);
      padding: 10px 16px;
      background: rgba(246,173,85,0.06);
      border-radius: 0 var(--radius) var(--radius) 0;
      margin: 16px 0;
      color: var(--text-secondary);
      font-style: italic;
    }

    .md-content blockquote p { margin-bottom: 0; }

    /* HR */
    .md-content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 28px 0;
    }

    /* Footer */
    .site-footer {
      margin-left: var(--sidebar-width);
      border-top: 1px solid var(--border);
      padding: 18px 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .footer-accent { color: var(--accent); font-weight: 600; }

    /* Sidebar overlay */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 89;
    }

    .sidebar-overlay.active { display: block; }

    /* Responsive */
    @media (max-width: 900px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); box-shadow: 4px 0 40px rgba(0,0,0,0.6); }
      .main { margin-left: 0; padding: 24px 16px; }
      .site-footer { margin-left: 0; padding: 14px 16px; flex-direction: column; gap: 6px; text-align: center; }
      .menu-toggle { display: flex; }
      .header-title { display: none; }
    }
"""


# ── Nav categories ─────────────────────────────────────────────────────────────

NAV_SECTIONS = [
    ("Business",    [("BRD", "📋"), ("PRD", "📝")]),
    ("Design",      [("PDD", "🎨"), ("VDD", "🎬"), ("ANIM", "✨"), ("AUDIO", "🔊")]),
    ("Engineering", [("EDD", "⚙️"), ("ARCH", "🏗️"), ("API", "🔌"), ("SCHEMA", "🗄️"), ("FRONTEND", "🖥️")]),
    ("Testing",     [("test-plan", "🧪"), ("RTM", "📊")]),
    ("Operations",  [("runbook", "📟"), ("LOCAL_DEPLOY", "🚀")]),
]


def make_nav_html(active_stem: str) -> str:
    parts = []
    for category, items in NAV_SECTIONS:
        parts.append(f'<div class="nav-section-label">{html_module.escape(category)}</div>')
        for stem, icon in items:
            label = DOC_META.get(stem, (stem, "", ""))[0]
            href  = f"{stem}.html"
            active_class = " active" if stem == active_stem else ""
            parts.append(
                f'<a href="{href}" class="nav-link{active_class}">'
                f'<span>{icon}</span>'
                f'<span>{html_module.escape(label)}</span>'
                f'</a>'
            )
    return "\n".join(parts)


# ── Minimal Markdown → HTML converter ─────────────────────────────────────────

def md_to_html(md: str) -> str:
    """
    Convert a subset of Markdown to HTML.
    Handles: headings, bold/italic, inline code, fenced code blocks (with mermaid),
    tables, blockquotes, unordered/ordered lists, horizontal rules, links, paragraphs.
    Tables are wrapped in overflow-x: auto divs.
    """
    lines  = md.splitlines()
    out    = []
    i      = 0
    in_ul  = False
    in_ol  = False

    def close_lists():
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def inline(text: str) -> str:
        """Process inline markdown elements."""
        # Escape HTML first
        text = html_module.escape(text)
        # Bold + italic ***...***
        text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', text)
        # Bold **...**
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        # Italic *...*
        text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
        # Inline code `...`
        text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
        # Links [text](url) — only allow safe URL schemes to prevent XSS
        def _safe_link(m: re.Match) -> str:
            raw_url = html_module.unescape(m.group(2))
            try:
                scheme = urlparse(raw_url).scheme.lower()
            except Exception:
                scheme = ""
            allowed_schemes = {"", "http", "https", "mailto"}
            if scheme not in allowed_schemes:
                # Render as plain escaped text rather than a live link
                return html_module.escape(m.group(1))
            safe_href = html_module.escape(raw_url, quote=True)
            return f'<a href="{safe_href}">{m.group(1)}</a>'

        text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', _safe_link, text)
        return text

    # ── Table detection helper ──────────────────────────────────────────────
    def is_table_row(line: str) -> bool:
        return line.strip().startswith("|") and "|" in line.strip()[1:]

    def is_separator_row(line: str) -> bool:
        stripped = line.strip()
        if not stripped.startswith("|"):
            return False
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        return all(re.match(r'^:?-+:?$', c) for c in cells if c)

    def parse_table(start_i: int) -> tuple[str, int]:
        """Parse a Markdown table starting at start_i, return HTML + next i."""
        j = start_i
        rows = []
        while j < len(lines) and is_table_row(lines[j]):
            cells = [c.strip() for c in lines[j].strip().strip("|").split("|")]
            rows.append(cells)
            j += 1

        if len(rows) < 2:
            # Not a real table — emit the raw line as a paragraph so nothing is silently dropped
            escaped = html_module.escape(lines[start_i])
            return f"<p>{escaped}</p>", start_i + 1

        # First row = header, second = separator
        header = rows[0]
        data   = [r for r in rows[2:] if r]  # skip separator

        buf = ['<div class="table-wrap"><table>']
        buf.append("<thead><tr>")
        for cell in header:
            buf.append(f"<th>{inline(cell)}</th>")
        buf.append("</tr></thead>")
        buf.append("<tbody>")
        for row in data:
            # Pad or truncate to match header width
            while len(row) < len(header):
                row.append("")
            buf.append("<tr>")
            for cell in row[:len(header)]:
                buf.append(f"<td>{inline(cell)}</td>")
            buf.append("</tr>")
        buf.append("</tbody></table></div>")
        return "\n".join(buf), j

    # ── Main loop ──────────────────────────────────────────────────────────
    while i < len(lines):
        line = lines[i]

        # ── Fenced code block ─────────────────────────────────────────────
        fence_match = re.match(r'^```(\w*)\s*$', line)
        if fence_match:
            close_lists()
            lang = fence_match.group(1).lower()
            code_lines = []
            i += 1
            # Guard against unclosed fences: stop at EOF or closing fence
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1  # skip closing ``` only when it actually exists

            code_body = "\n".join(code_lines)

            if lang == "mermaid":
                escaped = html_module.escape(code_body)
                out.append(f'<div class="mermaid-wrap"><div class="mermaid">{escaped}</div></div>')
            else:
                escaped = html_module.escape(code_body)
                # lang is already restricted to \w* by the regex, escape anyway for safety
                lang_attr = f' class="language-{html_module.escape(lang)}"' if lang else ""
                out.append(f"<pre><code{lang_attr}>{escaped}</code></pre>")
            continue

        # ── Table ─────────────────────────────────────────────────────────
        if is_table_row(line):
            close_lists()
            table_html, i = parse_table(i)
            if table_html:
                out.append(table_html)
            continue

        # ── Headings ──────────────────────────────────────────────────────
        h_match = re.match(r'^(#{1,6})\s+(.*)', line)
        if h_match:
            close_lists()
            level = len(h_match.group(1))
            text  = inline(h_match.group(2))
            # Create slug for anchor — prefix with 'h-' to handle numeric-only headings,
            # strip non-word characters, collapse whitespace, lowercase.
            raw_heading = html_module.unescape(h_match.group(2))
            slug = re.sub(r'[^\w\s-]', '', raw_heading)
            slug = re.sub(r'\s+', '-', slug.strip()).lower()
            slug = re.sub(r'-+', '-', slug).strip('-')  # collapse/trim extra hyphens
            if not slug or slug[0].isdigit():
                slug = 'h-' + (slug or str(level))
            safe_slug = html_module.escape(slug, quote=True)
            out.append(f'<h{level} id="{safe_slug}">{text}</h{level}>')
            i += 1
            continue

        # ── HR ────────────────────────────────────────────────────────────
        if re.match(r'^(-{3,}|\*{3,}|_{3,})\s*$', line):
            close_lists()
            out.append("<hr>")
            i += 1
            continue

        # ── Blockquote ────────────────────────────────────────────────────
        if line.startswith(">"):
            close_lists()
            bq_lines = []
            while i < len(lines) and lines[i].startswith(">"):
                bq_lines.append(lines[i].lstrip("> ").lstrip(">"))
                i += 1
            inner = inline(" ".join(bq_lines))
            out.append(f"<blockquote><p>{inner}</p></blockquote>")
            continue

        # ── Unordered list ────────────────────────────────────────────────
        ul_match = re.match(r'^(\s*)[*\-+]\s+(.*)', line)
        if ul_match:
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            text = inline(ul_match.group(2))
            out.append(f"<li>{text}</li>")
            i += 1
            continue

        # ── Ordered list ──────────────────────────────────────────────────
        ol_match = re.match(r'^\d+\.\s+(.*)', line)
        if ol_match:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            text = inline(ol_match.group(1))
            out.append(f"<li>{text}</li>")
            i += 1
            continue

        # ── Empty line ────────────────────────────────────────────────────
        if not line.strip():
            close_lists()
            i += 1
            continue

        # ── Paragraph ─────────────────────────────────────────────────────
        close_lists()
        # Gather paragraph lines (until blank or structural element)
        para_lines = []
        while i < len(lines) and lines[i].strip():
            peek = lines[i]
            if (re.match(r'^#{1,6}\s', peek) or
                    peek.startswith("```") or
                    peek.startswith(">") or
                    re.match(r'^(-{3,}|\*{3,}|_{3,})\s*$', peek) or
                    re.match(r'^(\s*)[*\-+]\s+', peek) or
                    re.match(r'^\d+\.\s+', peek) or
                    is_table_row(peek)):
                break
            para_lines.append(peek)
            i += 1

        if para_lines:
            combined = " ".join(para_lines)
            out.append(f"<p>{inline(combined)}</p>")
        else:
            i += 1
        continue

    close_lists()
    return "\n".join(out)


# ── HTML page template ─────────────────────────────────────────────────────────

def build_page(stem: str, title: str, body_html: str, source_file: str) -> str:
    meta = DOC_META.get(stem, (title, "Documentation", "📄"))
    display_title, category, icon = meta

    nav_html = make_nav_html(stem)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html_module.escape(display_title)} — Thunder Blessing GDD</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>{INLINE_CSS}</style>
</head>
<body>

  <header class="site-header">
    <button class="menu-toggle" aria-label="Toggle navigation" onclick="toggleSidebar()">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <a href="{INDEX_HREF}" class="header-logo">⚡ Thunder Blessing</a>
    <span class="header-title">{html_module.escape(display_title)}</span>
    <a href="{INDEX_HREF}" class="header-back">← Docs Hub</a>
  </header>

  <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

  <div class="layout">
    <nav class="sidebar" id="sidebar" aria-label="Documentation navigation">
      {nav_html}
    </nav>

    <main class="main" id="main">
      <div class="page-meta">
        <span>{icon} {html_module.escape(category)}</span>
        <span>Source: <code>{html_module.escape(source_file)}</code></span>
        <span>Generated: 2026-04-26</span>
      </div>
      <article class="md-content">
        {body_html}
      </article>
    </main>
  </div>

  <footer class="site-footer">
    <span>⚡ <span class="footer-accent">Thunder Blessing</span> GDD Documentation</span>
    <span>{html_module.escape(display_title)}</span>
    <span><a href="{INDEX_HREF}" style="color:var(--text-muted);text-decoration:none;">← Back to Hub</a></span>
  </footer>

  <script>
    function toggleSidebar() {{
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      const isOpen  = sidebar.classList.toggle('open');
      overlay.classList.toggle('active', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }}

    mermaid.initialize({{
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {{
        background:         '#1a2032',
        primaryColor:       '#1e2535',
        primaryBorderColor: '#2a3347',
        primaryTextColor:   '#e2e8f0',
        lineColor:          '#f6ad55',
        secondaryColor:     '#161b27',
        tertiaryColor:      '#0f1117',
        edgeLabelBackground:'#1a2032',
        clusterBkg:         '#1a2032',
        titleColor:         '#f6ad55',
      }}
    }});
  </script>
</body>
</html>"""


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    PAGES_DIR.mkdir(parents=True, exist_ok=True)

    md_files = sorted(DOCS_DIR.glob("*.md"))
    if not md_files:
        print("No .md files found in", DOCS_DIR, file=sys.stderr)
        sys.exit(1)

    generated = []
    skipped   = []

    for md_path in md_files:
        stem = md_path.stem
        out_path = PAGES_DIR / f"{stem}.html"

        try:
            md_text = md_path.read_text(encoding="utf-8")
        except Exception as exc:
            print(f"  ERROR reading {md_path.name}: {exc}", file=sys.stderr)
            skipped.append(md_path.name)
            continue

        # Extract title from first H1, fallback to stem
        title_match = re.search(r'^#\s+(.+)$', md_text, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else stem

        try:
            body_html = md_to_html(md_text)
        except Exception as exc:
            print(f"  ERROR converting {md_path.name}: {exc}", file=sys.stderr)
            skipped.append(md_path.name)
            continue

        page_html = build_page(stem, title, body_html, md_path.name)

        try:
            out_path.write_text(page_html, encoding="utf-8")
        except Exception as exc:
            print(f"  ERROR writing {out_path}: {exc}", file=sys.stderr)
            skipped.append(md_path.name)
            continue

        size_kb = len(page_html.encode("utf-8")) / 1024
        print(f"  [OK]  {md_path.name:25s}  →  {out_path.name:25s}  ({size_kb:.1f} KB)")
        generated.append(out_path.name)

    print()
    print(f"Generated {len(generated)} page(s) in {PAGES_DIR}")
    if skipped:
        print(f"Skipped   {len(skipped)} file(s): {', '.join(skipped)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    print("Thunder Blessing — GDD Site Generator")
    print("=" * 50)
    main()
