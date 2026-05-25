"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function AccountPrivacyPage() {
  return (
    <DocsContentLayout
      title="Account and Privacy"
      previousSection={{ title: "Reports", route: \"/sme/docs/reports" }}
      nextSection={{
        title: "Troubleshooting",
        route: \"/sme/docs/troubleshooting",
      }}
    >
      <section>
        <h2 id="privacy">Your data and who can see it</h2>
        <p>At FinWatch Zambia, we take your financial privacy seriously.</p>
        <ul>
          <li>
            <strong>Personal Data:</strong> Only you (the SME owner) can see
            your specific company data, the financial figures you enter, and
            your prediction results.
          </li>
          <li>
            <strong>Regulatory View:</strong> Regulators (like the Bank of
            Zambia or Ministry of Commerce) only see{" "}
            <strong>aggregate, anonymized data</strong>. This means they can see
            that "15% of businesses in the transport sector are distressed", but
            they <em>cannot</em> see your specific company name or your specific
            figures.
          </li>
          <li>
            <strong>Storage:</strong> Your data is stored securely in encrypted
            databases.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="settings">Managing your profile and settings</h2>
        <p>
          You can update your personal information and business details at any
          time:
        </p>
        <ul>
          <li>
            <strong>Profile Picture:</strong> You can upload an avatar to
            personalize your dashboard. Our system preserves your original
            image, allowing you to re-crop it later without losing quality.
          </li>
          <li>
            <strong>Business Scale:</strong> If your business grows from Small
            to Medium, you can update your scale in your profile settings to
            receive more technical AI assessments.
          </li>
          <li>
            <strong>Password:</strong> We recommend changing your password every
            90 days to maintain account security.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="deletion">Deleting your account — what happens to your data</h2>
        <p>
          You have the right to be forgotten. If you choose to delete your
          account:
        </p>
        <ol>
          <li>All your company profiles will be removed.</li>
          <li>
            All your historical predictions and AI narratives will be
            permanently deleted.
          </li>
          <li>
            Any uploaded financial documents will be purged from our storage.
          </li>
        </ol>
        <p>
          <strong>Warning:</strong> This action is irreversible. Once deleted,
          your data cannot be recovered.
        </p>
      </section>

      <section>
        <h2 id="security">Session Security</h2>
        <p>
          To protect your account, FinWatch uses secure JSON Web Tokens (JWT).
        </p>
        <ul>
          <li>
            <strong>Web Sessions:</strong> For your security, web sessions may
            require you to log in again after a period of inactivity.
          </li>
          <li>
            <strong>Mobile Sessions:</strong> On our Android app, sessions are
            persisted for up to 30 days, allowing you to access your data
            quickly without logging in every time you open the app.
          </li>
        </ul>
      </section>
    </DocsContentLayout>
  );
}
