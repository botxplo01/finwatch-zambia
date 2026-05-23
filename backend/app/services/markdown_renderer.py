"""
FinWatch Zambia - Markdown to ReportLab Renderer

Converts Markdown text into a list of ReportLab Flowables.
Uses mistune AST parser for reliable structured rendering.
"""

from __future__ import annotations

import mistune
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    Paragraph,
    Spacer,
    ListFlowable,
    ListItem,
)
from reportlab.lib.units import cm

class ReportLabRenderer:
    """
    A custom renderer for mistune that outputs ReportLab flowables.
    We actually use the AST parser and traverse it manually for better control.
    """
    def __init__(self, styles: dict[str, ParagraphStyle]):
        self.styles = styles
        self.markdown = mistune.create_markdown(renderer=None) # AST renderer

    def render(self, text: str) -> list:
        if not text:
            return []
        
        # mistune 3.x uses 'raw' instead of 'text' in some places
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
            # Map levels to styles
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
                    # List items can contain paragraphs, block_text or multiple nodes
                    item_flowables = self._process_nodes(item_node.get("children", []))
                    items.append(ListItem(item_flowables, leftIndent=10))
            
            bullet_type = "1" if ordered else "bullet"
            return ListFlowable(
                items,
                bulletType=bullet_type,
                leftIndent=20,
                bulletFontSize=9,
                spaceBefore=5,
                spaceAfter=5
            )
        
        elif node_type == "block_text":
            # mistune 3.x lists wrap content in block_text
            inner_text = self._render_inline(node.get("children", []))
            return Paragraph(inner_text, self.styles.get("body"))

        elif node_type == "blank_line":
            return Spacer(1, 0.2 * cm)
        
        return None

    def _render_inline(self, nodes: list) -> str:
        """Converts inline nodes to ReportLab-compatible XML strings."""
        parts = []
        for node in nodes:
            node_type = node.get("type")
            if node_type == "text":
                parts.append(node.get("raw", ""))
            elif node_type == "strong":
                inner = self._render_inline(node.get("children", []))
                parts.append(f"<b>{inner}</b>")
            elif node_type == "emphasis":
                inner = self._render_inline(node.get("children", []))
                parts.append(f"<i>{inner}</i>")
            elif node_type == "codespan":
                parts.append(f'<font name="Courier">{node.get("raw", "")}</font>')
            elif node_type == "linebreak":
                parts.append("<br/>")
            elif node_type == "softbreak":
                parts.append(" ")
        return "".join(parts)

def markdown_to_flowables(text: str, styles: dict[str, ParagraphStyle]) -> list:
    """Convenience function to convert markdown to ReportLab flowables."""
    renderer = ReportLabRenderer(styles)
    return renderer.render(text)
