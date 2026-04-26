"""
FinWatch Zambia - Narrative Schemas

NarrativeResponse (embedded view) lives in prediction.py.
NarrativeDetailResponse (standalone view) is defined here for independent queries.
"""

from datetime import datetime

from pydantic import BaseModel


class NarrativeDetailResponse(BaseModel):
    """Full narrative record including all metadata."""

    id: int
    prediction_id: int
    content: str
    source: str
    cache_key: str
    generated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def word_count(self) -> int:
        """Approximate word count of the narrative content."""
        return len(self.content.split())


class NarrativeSourceSummary(BaseModel):
    """Aggregate summary of narrative sources across all predictions."""

    groq_count: int = 0
    ollama_count: int = 0
    template_count: int = 0
    total: int = 0

    @property
    def groq_pct(self) -> float:
        return round(self.groq_count / self.total * 100, 1) if self.total else 0.0

    @property
    def ollama_pct(self) -> float:
        return round(self.ollama_count / self.total * 100, 1) if self.total else 0.0

    @property
    def template_pct(self) -> float:
        return round(self.template_count / self.total * 100, 1) if self.total else 0.0
