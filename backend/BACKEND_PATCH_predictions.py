# =============================================================================
# FinWatch Zambia — Predictions Router PATCH
#
# Replace the existing list_predictions endpoint in backend/app/api/predictions.py
# with this version. The frontend History page requires:
#
#   1. Paginated response shape: { items, total, skip, limit }
#   2. company_name and period included in each summary item
#   3. risk_label field (backend already has this — just expose it)
#   4. predicted_at field (backend already has this — just expose it)
#   5. Optional company_id and model_name query filters
#
# WHAT TO CHANGE:
#   - Replace the list_predictions function below
#   - Add PaginatedPredictionResponse to app/schemas/prediction.py (see bottom)
#   - No ORM model changes needed
# =============================================================================

# ── Step 1: Add to app/schemas/prediction.py ─────────────────────────────────
#
# from typing import List
#
# class PredictionSummaryResponse(BaseModel):
#     id:                   int
#     company_name:         str
#     period:               str
#     model_used:           str
#     risk_label:           str
#     distress_probability: float
#     predicted_at:         datetime
#
#     model_config = {"from_attributes": True}
#
# class PaginatedPredictionResponse(BaseModel):
#     items: List[PredictionSummaryResponse]
#     total: int
#     skip:  int
#     limit: int


# ── Step 2: Replace list_predictions in app/api/predictions.py ───────────────

# @router.get(
#     "/",
#     response_model=PaginatedPredictionResponse,
#     summary="List prediction history for the current user (paginated)",
# )
# def list_predictions(
#     company_id: int | None = Query(default=None),
#     model_name: str | None = Query(default=None),
#     skip:  int = Query(default=0,  ge=0),
#     limit: int = Query(default=10, ge=1, le=200),
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_active_user),
# ):
#     query = (
#         db.query(Prediction, Company.name.label("company_name"), FinancialRecord.period)
#         .join(RatioFeature,    Prediction.ratio_feature_id       == RatioFeature.id)
#         .join(FinancialRecord, RatioFeature.financial_record_id  == FinancialRecord.id)
#         .join(Company,         FinancialRecord.company_id         == Company.id)
#         .filter(Company.owner_id == current_user.id)
#     )
#
#     if company_id:
#         query = query.filter(Company.id == company_id)
#     if model_name:
#         query = query.filter(Prediction.model_used == model_name)
#
#     total = query.count()
#
#     results = (
#         query
#         .order_by(Prediction.predicted_at.desc())
#         .offset(skip)
#         .limit(limit)
#         .all()
#     )
#
#     items = [
#         {
#             "id":                   pred.id,
#             "company_name":         company_name,
#             "period":               period,
#             "model_used":           pred.model_used,
#             "risk_label":           pred.risk_label,
#             "distress_probability": pred.distress_probability,
#             "predicted_at":         pred.predicted_at,
#         }
#         for pred, company_name, period in results
#     ]
#
#     return {"items": items, "total": total, "skip": skip, "limit": limit}
