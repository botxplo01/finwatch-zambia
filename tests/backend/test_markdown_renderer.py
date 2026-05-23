"""
FinWatch Zambia - Markdown Renderer Regression Tests

Tests the conversion of Markdown text into ReportLab Flowables.
Covers: headings, bold/italic, lists, and nested structures.
"""

import pytest
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, ListFlowable, ListItem
from app.services.markdown_renderer import markdown_to_flowables

@pytest.fixture
def styles():
    """Provides a basic style sheet for testing."""
    s = getSampleStyleSheet()
    # Add FinWatch specific styles expected by the renderer
    # Using unique names to avoid collisions with standard stylesheet
    st_section = ParagraphStyle(name="section", fontSize=12, leading=14)
    st_h2 = ParagraphStyle(name="h2_custom", fontSize=11, leading=13)
    st_h3 = ParagraphStyle(name="h3_custom", fontSize=10, leading=12)
    st_body = ParagraphStyle(name="body_custom", fontSize=10, leading=12)
    
    return {
        "section": st_section,
        "h2": st_h2,
        "h3": st_h3,
        "body": st_body
    }

def test_render_simple_paragraph(styles):
    text = "This is a simple paragraph."
    flowables = markdown_to_flowables(text, styles)
    assert len(flowables) == 1
    assert isinstance(flowables[0], Paragraph)
    assert flowables[0].text == "This is a simple paragraph."

def test_render_bold_and_italic(styles):
    text = "This is **bold** and *italic* text."
    flowables = markdown_to_flowables(text, styles)
    assert len(flowables) == 1
    assert "<b>bold</b>" in flowables[0].text
    assert "<i>italic</i>" in flowables[0].text

def test_render_headings(styles):
    text = "# Heading 1\n## Heading 2\n### Heading 3"
    flowables = markdown_to_flowables(text, styles)
    assert len(flowables) == 3
    assert all(isinstance(f, Paragraph) for f in flowables)
    # Level 1 uses 'section' style
    assert flowables[0].style.name == "section"
    # Level 2 uses 'h2' style
    assert flowables[1].style.name == "h2_custom"
    # Level 3 uses 'h3' style
    assert flowables[2].style.name == "h3_custom"

def test_render_unordered_list(styles):
    text = "- Item 1\n- Item 2\n- Item 3"
    flowables = markdown_to_flowables(text, styles)
    assert len(flowables) == 1
    assert isinstance(flowables[0], ListFlowable)
    assert len(flowables[0]._flowables) == 3
    for item in flowables[0]._flowables:
        assert isinstance(item, ListItem)
        assert any(isinstance(f, Paragraph) for f in item._flowables)

def test_render_ordered_list(styles):
    text = "1. First\n2. Second"
    flowables = markdown_to_flowables(text, styles)
    assert len(flowables) == 1
    assert isinstance(flowables[0], ListFlowable)
    assert flowables[0]._bulletType == "1"

def test_render_nested_list(styles):
    text = "- Parent\n  - Child 1\n  - Child 2"
    flowables = markdown_to_flowables(text, styles)
    assert len(flowables) == 1
    assert isinstance(flowables[0], ListFlowable)
    parent_item = flowables[0]._flowables[0]
    assert any(isinstance(f, ListFlowable) for f in parent_item._flowables)

def test_render_mixed_content(styles):
    text = """
### Analysis Results
Based on the data:
1. **Solvency** is good.
2. *Profitability* is low.

Please review immediately.
"""
    flowables = markdown_to_flowables(text.strip(), styles)
    assert any("<b>Analysis Results</b>" in f.text for f in flowables if isinstance(f, Paragraph))
    
    lf = next(f for f in flowables if isinstance(f, ListFlowable))
    item1_para = lf._flowables[0]._flowables[0]
    assert "<b>Solvency</b>" in item1_para.text
