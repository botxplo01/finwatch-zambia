"""
FinWatch Zambia - Extraction Service

Handles parsing of Balance Sheets and Income Statements from various formats.
Uses NLP to extract structured data from unstructured text.
"""

import io
import pandas as pd
import PyPDF2
import re
from typing import Dict
import logging
import json
from app.core.config import settings
from app.services.nlp_service import run_fallback_chain

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """
You are a highly accurate financial data extraction assistant for FinWatch Zambia.
Your task is to extract 12 specific financial values from the provided document text (Balance Sheet or Income Statement).

REQUIRED FIELDS (JSON keys):
1. current_assets: Cash, receivables, short-term investments.
2. current_liabilities: Accounts payable, short-term debt, tax payable.
3. total_assets: All assets combined.
4. total_liabilities: All short and long-term liabilities.
5. total_equity: Share capital + Retained earnings.
6. inventory: Raw materials, work-in-progress, finished goods.
7. cash_and_equivalents: Cash at bank, cash in hand, highly liquid assets.
8. retained_earnings: Cumulative profits/losses not distributed to shareholders.
9. revenue: Total sales, turnover, or gross income from operations.
10. net_income: Net profit, profit for the year, or net loss (if negative).
11. ebit: Operating profit, earnings before interest and taxes.
12. interest_expense: Finance costs, interest paid on loans.

GUIDELINES:
- BE FLEXIBLE WITH LABELS: Companies use different names. Map them to the keys above based on financial meaning.
- MULTIPLE YEARS: If the document shows multiple years (e.g., 2024 and 2023), ALWAYS extract the most RECENT year.
- NUMERICAL VALUES: Clean values (ignore currency symbols and commas). If a value is in parentheses like (500), treat it as negative -500.0.
- MISSING DATA: If a value is definitely not present in the text, return 0.0 for that key.
- FORMAT: Return ONLY a valid JSON object. No preamble, no markdown blocks, no explanation.
"""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF file with basic cleaning."""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for i, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            if page_text:
                text += f"--- Page {i+1} ---\n{page_text}\n"

        # Basic cleaning: remove excessive whitespace but preserve some structure
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n", "\n\n", text)

        logger.info(f"Extracted {len(text)} characters from PDF")
        return text.strip()
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return ""


def extract_data_from_spreadsheet(file_bytes: bytes, filename: str) -> Dict[str, float]:
    """Extract data from CSV or XLSX using pandas."""
    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))

        # Enhanced mapping heuristic: find columns that match our field names
        data = {}
        mapping = {
            "current_assets": [
                "current assets",
                "total current assets",
                "total current asset",
            ],
            "current_liabilities": [
                "current liabilities",
                "total current liabilities",
                "total current liability",
            ],
            "total_assets": ["total assets", "total asset"],
            "total_liabilities": ["total liabilities", "total liability"],
            "total_equity": [
                "total equity",
                "shareholders equity",
                "shareholder's equity",
                "owners equity",
            ],
            "inventory": ["inventory", "stock", "inventories"],
            "cash_and_equivalents": [
                "cash",
                "cash and equivalents",
                "cash & equivalents",
                "cash and bank",
            ],
            "retained_earnings": [
                "retained earnings",
                "accumulated profit",
                "accumulated loss",
            ],
            "revenue": ["revenue", "sales", "turnover", "total revenue", "total sales"],
            "net_income": [
                "net income",
                "net profit",
                "profit for the year",
                "profit after tax",
            ],
            "ebit": [
                "ebit",
                "operating income",
                "operating profit",
                "profit before interest and tax",
            ],
            "interest_expense": [
                "interest expense",
                "finance costs",
                "interest payable",
            ],
        }

        # Flatten the dataframe to a dict of lowercase strings to values
        flat_data = {}
        for _, row in df.iterrows():
            # Check all columns for potential labels
            row_list = [str(val).lower().strip() for val in row.tolist()]
            for i, item in enumerate(row_list):
                # If we find a label, the value is usually in the next column or the one after
                for j in range(i + 1, min(i + 4, len(row))):
                    try:
                        val_str = (
                            str(row.iloc[j])
                            .replace(",", "")
                            .replace("(", "-")
                            .replace(")", "")
                        )
                        value = float(val_str)
                        if item not in flat_data:  # Keep first occurrence
                            flat_data[item] = value
                    except (ValueError, TypeError):
                        continue

        extracted = {}
        for field, keywords in mapping.items():
            found = False
            for kw in keywords:
                if kw in flat_data:
                    extracted[field] = flat_data[kw]
                    found = True
                    break
            if not found:
                extracted[field] = 0.0

        return extracted
    except Exception as e:
        logger.error(f"Spreadsheet extraction failed: {e}")
        return {
            k: 0.0
            for k in [
                "current_assets",
                "current_liabilities",
                "total_assets",
                "total_liabilities",
                "total_equity",
                "inventory",
                "cash_and_equivalents",
                "retained_earnings",
                "revenue",
                "net_income",
                "ebit",
                "interest_expense",
            ]
        }


async def parse_financial_document(
    file_bytes: bytes, filename: str
) -> Dict[str, float]:
    """Orchestrate extraction based on file type."""
    default_values = {
        k: 0.0
        for k in [
            "current_assets",
            "current_liabilities",
            "total_assets",
            "total_liabilities",
            "total_equity",
            "inventory",
            "cash_and_equivalents",
            "retained_earnings",
            "revenue",
            "net_income",
            "ebit",
            "interest_expense",
        ]
    }

    if filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
        if not text or len(text) < 50:
            logger.warning(
                f"PDF text extraction returned insufficient content ({len(text)} chars)"
            )
            raise ValueError(
                "PDF data extraction is currently unavailable. Please try using a spreadsheet file instead, or manually enter the data."
            )

        prompt = f"Extract financial data from this document text. Be flexible with labels but strict with values.\n\nTEXT:\n{text}"
        try:
            content, source = await run_fallback_chain(
                prompt,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                log_prefix="Extraction",
                override_api_key=settings.EXTRACTION_GROQ_API_KEY,
                override_model=settings.EXTRACTION_GROQ_MODEL,
            )

            # Intelligent Failure Detection: check if LLM admitted failure
            lower_content = content.lower()
            if any(
                indicator in lower_content
                for indicator in [
                    "cannot extract",
                    "unable to",
                    "unsuccessful",
                    "invalid",
                    "incomplete",
                    "no data found",
                ]
            ):
                logger.warning(
                    f"LLM indicated extraction failure for {filename}: {content[:100]}..."
                )
                raise ValueError(
                    "PDF data extraction is currently unavailable. Please try using a spreadsheet file instead, or manually enter the data."
                )

            # Clean content in case of markdown or extra text
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                extracted = json.loads(match.group(0))
            else:
                extracted = json.loads(content)

            # Ensure it's not just an empty/zeroed object if the LLM failed silently
            if not isinstance(extracted, dict) or not extracted:
                raise ValueError("Malformed response from extraction engine.")

            # Ensure all keys are present
            result = default_values.copy()
            for k in result.keys():
                if k in extracted:
                    try:
                        result[k] = float(extracted[k])
                    except (ValueError, TypeError):
                        pass

            # If everything is 0, it's likely a failure
            if sum(1 for v in result.values() if v != 0.0) == 0:
                logger.warning(f"Extraction for {filename} resulted in all zeros.")
                raise ValueError(
                    "PDF data extraction is currently unavailable. Please try using a spreadsheet file instead, or manually enter the data."
                )

            return result
        except Exception as e:
            logger.error(f"NLP extraction failed for {filename}: {e}")
            raise ValueError(
                "PDF data extraction is currently unavailable. Please try using a spreadsheet file instead, or manually enter the data."
            )

    elif filename.lower().endswith((".csv", ".xlsx", ".xls")):
        try:
            result = extract_data_from_spreadsheet(file_bytes, filename)
            # If everything is 0, it's a failure
            if sum(1 for v in result.values() if v != 0.0) == 0:
                raise ValueError(
                    "Spreadsheet data extraction is currently unavailable. Please try using a PDF instead, or manually enter the data."
                )
            return result
        except Exception:
            raise ValueError(
                "Spreadsheet data extraction is currently unavailable. Please try using a PDF instead, or manually enter the data."
            )

    return default_values
