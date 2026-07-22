"""
FinWatch Zambia - Markdown to ReportLab Renderer

Converts Markdown text into a list of ReportLab Flowables.
Uses mistune AST parser for reliable structured rendering.
"""

from __future__ import annotations

import mistune
from mistune.plugins.table import table
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

_resolved_fonts: dict[str, str] = {}

def _get_fonts() -> tuple[str, str]:
    """Return (header_font, mono_font), resolving once and caching the result."""
    if not _resolved_fonts:
        try:
            pdfmetrics.getFont("Geist-Bold")
            _resolved_fonts["header"] = "Geist-Bold"
        except Exception:
            _resolved_fonts["header"] = "Helvetica-Bold"
        try:
            pdfmetrics.getFont("GeistMono")
            _resolved_fonts["mono"] = "GeistMono"
        except Exception:
            _resolved_fonts["mono"] = "Courier"
    return _resolved_fonts["header"], _resolved_fonts["mono"]

class ReportLabRenderer:
    """
    A custom renderer for mistune that outputs ReportLab flowables.
    We actually use the AST parser and traverse it manually for better control.
    """

    def __init__(self, styles: dict[str, ParagraphStyle]):
        self.styles = styles

        self.markdown = mistune.create_markdown(renderer=None, plugins=[table])

    def render(self, text: str) -> list:
        if not text:
            return []

        ast = self.markdown(text)
        return self._process_nodes(ast)

    def _process_nodes(self, nodes: list) -> list:
        flowables = []
        for node in nodes:
            res = self._handle_node(node)
            if isinstance(res, list):
                flowables.extend(res)
            elif res:
                flowables.append(res)
        return flowables

    def _handle_node(self, node: dict):
        node_type = node.get("type")

        if node_type == "paragraph":
            inner_text = self._render_inline(node.get("children", []))
            return Paragraph(inner_text, self.styles.get("body"))

        elif node_type == "heading":
            level = node.get("attrs", {}).get("level", 1)
            inner_text = self._render_inline(node.get("children", []))

            if level == 1:
                style = self.styles.get("section")
            elif level == 2:
                style = self.styles.get("h2")
            else:
                style = self.styles.get("h3")
            return Paragraph(f"<b>{inner_text}</b>", style)

        elif node_type == "list":
            ordered = node.get("attrs", {}).get("ordered", False)
            items = []
            for item_node in node.get("children", []):
                if item_node.get("type") == "list_item":

                    item_flowables = self._process_nodes(item_node.get("children", []))
                    items.append(ListItem(item_flowables, leftIndent=10))

            bullet_type = "1" if ordered else "bullet"
            return ListFlowable(
                items,
                bulletType=bullet_type,
                leftIndent=20,
                bulletFontSize=9,
                spaceBefore=5,
                spaceAfter=5,
            )

        elif node_type == "table":

            data = []
            children = node.get("children", [])
            for section in children:
                if section.get("type") in ["table_head", "table_body"]:
                    for row in section.get("children", []):
                        if row.get("type") == "table_row":
                            row_data = []
                            for cell in row.get("children", []):

                                cell_text = self._render_inline(
                                    cell.get("children", [])
                                )
                                row_data.append(
                                    Paragraph(
                                        cell_text,
                                        self.styles.get("body_small")
                                        or self.styles.get("body"),
                                    )
                                )
                            data.append(row_data)

            if not data:
                return None

            t = Table(data, hAlign="LEFT")
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("FONTNAME", (0, 0), (-1, 0), _get_fonts()[0]),
                        ("FONTSIZE", (0, 0), (-1, 0), 10),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ]
                )
            )
            return [Spacer(1, 0.2 * cm), t, Spacer(1, 0.4 * cm)]

        elif node_type == "block_text":

            inner_text = self._render_inline(node.get("children", []))
            return Paragraph(inner_text, self.styles.get("body"))

        elif node_type == "blank_line":
            return Spacer(1, 0.2 * cm)

        return None

    @staticmethod
    def _sanitize(text: str) -> str:
        """Replace Unicode characters unsupported by Helvetica with safe ASCII equivalents."""
        return (
            text
            .replace("\u2013", "-")   # en-dash
            .replace("\u2014", "-")   # em-dash
            .replace("\u2212", "-")   # minus sign
            .replace("\u2022", "*")   # bullet
            .replace("\u2018", "'")   # left single quotation
            .replace("\u2019", "'")   # right single quotation
            .replace("\u201c", '"')   # left double quotation
            .replace("\u201d", '"')   # right double quotation
            .replace("\u2026", "...") # horizontal ellipsis
            .replace("\u00b7", "-")   # middle dot
            .replace("\u00d7", "x")   # multiplication sign
            .replace("\u2264", "<=")  # less-than or equal
            .replace("\u2265", ">=")  # greater-than or equal
            .replace("\u00a0", " ")   # non-breaking space
            .replace("\u2192", "->")  # rightward arrow
            .replace("\u2190", "<-")  # leftward arrow
        )

    def _render_inline(self, nodes: list) -> str:
        """Converts inline nodes to ReportLab-compatible XML strings."""
        parts = []
        for node in nodes:
            node_type = node.get("type")
            if node_type == "text":
                parts.append(self._sanitize(node.get("raw", "")))
            elif node_type == "strong":
                inner = self._render_inline(node.get("children", []))
                parts.append(f"<b>{inner}</b>")
            elif node_type == "emphasis":
                inner = self._render_inline(node.get("children", []))
                parts.append(f"<i>{inner}</i>")
            elif node_type == "codespan":
                parts.append(f'<font name="{_get_fonts()[1]}">{self._sanitize(node.get("raw", ""))}</font>')
            elif node_type == "linebreak":
                parts.append("<br/>")
            elif node_type == "softbreak":
                parts.append(" ")
        return "".join(parts)

def markdown_to_flowables(text: str, styles: dict[str, ParagraphStyle]) -> list:
    """Convenience function to convert markdown to ReportLab flowables."""
    renderer = ReportLabRenderer(styles)
    return renderer.render(text)
