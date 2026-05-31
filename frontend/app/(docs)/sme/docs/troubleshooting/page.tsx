"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function TroubleshootingPage() {
  return (
    <DocsContentLayout
      title="Troubleshooting"
      previousSection={{
        title: "Account and Privacy",
        route: "/sme/docs/account-privacy",
      }}
    >
      <section>
        <h2 id="common-issues">Common Issues</h2>
        <p>
          If you encounter problems while using FinWatch Zambia, please check
          these common solutions before contacting support.
        </p>
      </section>

      <section>
        <h2 id="connection">The system is not loading</h2>
        <p>
          FinWatch requires an active internet connection. If the app feels
          &quot;stuck&quot;:
        </p>
        <ul>
          <li>
            <strong>Check Connection:</strong> Ensure your mobile data or Wi-Fi
            is active.
          </li>
          <li>
            <strong>Heartbeat Indicator:</strong> Look for the small pulse icon
            in the top bar. If it turns red, it means the app has lost
            connection to the server.
          </li>
          <li>
            <strong>Refresh:</strong> On web, press F5. On mobile, close and
            restart the app.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="prediction-issues">My prediction is not generating</h2>
        <ul>
          <li>
            <strong>Required Fields:</strong> Ensure all fields in the financial
            data form are filled. Use &quot;0&quot; for fields that don&apos;t apply, rather
            than leaving them blank.
          </li>
          <li>
            <strong>Invalid Data:</strong> If you see an error saying &quot;Invalid
            input&quot;, check that you haven&apos;t entered letters where numbers are
            expected.
          </li>
          <li>
            <strong>Model Timeout:</strong> Occasionally, the AI model may take
            longer than usual. If it takes more than 30 seconds, try refreshing
            the page and running it again.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="extraction-issues">Document upload is not extracting data</h2>
        <ul>
          <li>
            <strong>File Quality:</strong> Ensure the document is clear and
            readable. Scanned documents with very low light or blurry text may
            fail.
          </li>
          <li>
            <strong>File Format:</strong> Only PDF, CSV, XLSX, and XLS are
            supported.
          </li>
          <li>
            <strong>Password Protection:</strong> The system cannot extract data
            from password-protected or encrypted PDF files.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="assistant-issues">The AI Assistant is not responding</h2>
        <ul>
          <li>
            <strong>Usage Limit:</strong> You may have reached your 15-message
            limit. Check the counter at the bottom of the chat panel.
          </li>
          <li>
            <strong>Cooldown:</strong> If you have reached the limit, you will
            need to wait for the 2-hour cooldown window to pass.
          </li>
          <li>
            <strong>Fallback:</strong> If the primary AI is offline, the
            assistant will switch to &quot;Template Mode&quot; and give you pre-written
            answers to common questions.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="login-problems">I cannot log in</h2>
        <ul>
          <li>
            <strong>Email Verification:</strong> Ensure you are using the exact
            email you registered with.
          </li>
          <li>
            <strong>Caps Lock:</strong> Passwords are case-sensitive. Check your
            keyboard&apos;s Caps Lock.
          </li>
          <li>
            <strong>Role Conflict:</strong> Ensure you are trying to log in
            through the correct portal. SME owners cannot log in through the
            Regulator portal.
          </li>
        </ul>
      </section>
    </DocsContentLayout>
  );
}
