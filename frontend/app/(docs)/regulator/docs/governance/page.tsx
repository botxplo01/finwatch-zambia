"use client";

/**
 * FinWatch Zambia - AI Governance Documentation
 */

import { InstitutionalDocsContentLayout } from "@/components/docs/InstitutionalDocsContentLayout";

export default function AIGovernanceDocsPage() {
  return (
    <InstitutionalDocsContentLayout
      title="AI Governance"
      previousSection={{
        title: "Institutional Reporting",
        route: "/regulator/docs/reporting",
      }}
      nextSection={{
        title: "Regulator FAQ",
        route: "/regulator/docs/faq",
      }}
    >
      <section>
        <h2 id="transparency">Model Transparency (Explainable AI)</h2>
        <p>
          FinWatch utilizes{" "}
          <strong>SHAP (SHapley Additive exPlanations)</strong> to ensure that
          AI predictions are not &quot;black boxes.&quot;
        </p>
        <p>
          For every assessment, the system calculates the specific contribution
          of each financial ratio to the final risk score. This transparency
          allows regulators to audit the reasoning behind high-distress flags
          and ensure that the AI is identifying legitimate financial risks
          rather than statistical noise.
        </p>
      </section>

      <section>
        <h2 id="ethics">Ethics, Fairness, and Bias Mitigation</h2>
        <p>
          To maintain fairness in financial assessments, the FinWatch AI engine
          is designed with systemic safeguards:
        </p>
        <ul>
          <li>
            <strong>Role-Based Prompting:</strong> The AI Assistant&apos;s guidance
            is tailored to the user&apos;s scale (Small vs. Medium), ensuring that
            advice is accessible and relevant without being condescending or
            overly complex.
          </li>
          <li>
            <strong>Oversight-Only:</strong> Regulators are prevented from
            seeing individual company data, ensuring that the system is used for
            systemic health monitoring rather than individual business
            targeting.
          </li>
          <li>
            <strong>Model Balancing:</strong> We use techniques like{" "}
            <strong>SMOTE</strong> during training to ensure that the AI remains
            accurate for both healthy and distressed business patterns.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="audit">System Audit Trails</h2>
        <p>
          The platform maintains comprehensive logs of system activity for
          institutional accountability:
        </p>
        <ol>
          <li>
            <strong>API Usage Logs:</strong> Tracking the number of assessments
            and AI interactions per department.
          </li>
          <li>
            <strong>Access Logs:</strong> Monitoring institutional user logins
            and report generation activities.
          </li>
          <li>
            <strong>Data PURGE Policy:</strong> When an SME owner deletes their
            account, all associated data is permanently and irreversibly purged
            from both SME and Regulator-facing databases within 24 hours.
          </li>
        </ol>
      </section>
    </InstitutionalDocsContentLayout>
  );
}
