
import sqlite3
import os

db_path = os.path.join("backend", "finwatch.db")

def audit():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT total_assets FROM financial_records LIMIT 5")
    samples = cursor.fetchall()
    print(f"Sample total_assets: {samples}")

    cursor.execute("SELECT id, name, industry FROM companies")
    all_companies = cursor.fetchall()
    print(f"All companies: {all_companies}")

    cursor.execute("SELECT DISTINCT industry FROM companies")

    industries = cursor.fetchall()
    print(f"Distinct industries: {industries}")

    restricted_industries = ('Healthcare', 'Mining', 'Financial Services')

    indicative_assets = 100000.0

    query = """
    SELECT 
        fr.id as record_id, 
        c.id as company_id, 
        c.name as company_name, 
        c.industry 
    FROM financial_records fr
    JOIN companies c ON fr.company_id = c.id
    WHERE fr.total_assets = ? AND c.industry IN (?, ?, ?)
    """
    
    cursor.execute(query, (indicative_assets,) + restricted_industries)
    records = cursor.fetchall()

    if not records:
        print("No historical indicative assessments found in the local database.")
        conn.close()
        return

    print(f"Found {len(records)} affected records:")
    for rec in records:
        record_id, company_id, company_name, industry = rec
        
        # Check for predictions
        pred_query = """
        SELECT p.id, p.risk_label, p.model_used
        FROM predictions p
        JOIN ratio_features rf ON p.ratio_feature_id = rf.id
        WHERE rf.financial_record_id = ?
        """
        cursor.execute(pred_query, (record_id,))
        predictions = cursor.fetchall()
        
        pred_info = []
        for p in predictions:
            pred_info.append(f"Prediction(id={p[0]}, label={p[1]}, model={p[2]})")
        
        preds_str = ", ".join(pred_info) if pred_info else "No predictions found"
        print(f"- Record ID: {record_id}, Company ID: {company_id}, Industry: {industry}, Company: {company_name}")
        print(f"  {preds_str}")

    conn.close()

if __name__ == "__main__":
    audit()
