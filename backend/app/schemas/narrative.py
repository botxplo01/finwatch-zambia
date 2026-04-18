# =============================================================================
# FinWatch Zambia — Narrative Schemas
#
# NarrativeResponse (embedded view) lives in prediction.py because it is
# always returned as a nested object within a PredictionResponse.
#
# NarrativeDetailResponse (standalone view) is defined here for cases where
# narratives are queried independently — admin cache inspection, quality
# evaluation during dissertation testing, or direct API access.
# =============================================================================

from datetime import datetime

from pydantic import BaseModel


class NarrativeDetailResponse(BaseModel):
    """
    Full narrative record including all metadata.

    Used when narratives are queried independently from their parent
    prediction — e.g. admin cache audit, NLP quality evaluation.

    Fields:
      id             — database primary key
      prediction_id  — linked prediction
      content        — the full generated narrative text
      source         — inference tier that produced this narrative:
                       "groq" | "ollama" | "template"
      cache_key      — SHA-256 hash of (ratio_values + model_used).
                       Identical financial profiles share a cache_key,
                       meaning a stored narrative is returned without
                       a new API call.
      generated_at   — UTC timestamp of generation
      word_count     — computed property for NLP quality evaluation
    """

    id: int
    prediction_id: int
    content: str
    source: str
    cache_key: str
    generated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def word_count(self) -> int:
        """
        Approximate word count of the narrative content.
        Used during NLP quality evaluation — target range is 180–220 words
        per the dissertation NLP evaluation rubric.
        """
        return len(self.content.split())


class NarrativeSourceSummary(BaseModel):
    """
    Aggregate summary of narrative sources across all predictions.
    Used by the admin stats endpoint to show NLP fallback chain usage.
    """

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
