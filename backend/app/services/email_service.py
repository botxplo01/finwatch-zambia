import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SME_PURPLE = "#8B5CF6"
INST_EMERALD = "#10B981"
# Change this to your actual deployed URL
LOGO_URL = "https://finwatch-zambia.vercel.app/brand/FinWatch_Logo_Main.png"


def get_otp_template(otp: str, portal_type: str) -> str:
    """Generate portal-aware HTML template for OTP with a premium banner."""
    accent_color = SME_PURPLE if portal_type == "sme" else INST_EMERALD
    portal_name = "SME Portal" if portal_type == "sme" else "Institutional Portal"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .banner {{ background-color: #000000; padding: 40px 20px; text-align: center; border-radius: 24px 24px 0 0; }}
            .logo {{ width: 220px; height: auto; color: #ffffff; font-weight: 800; font-size: 24px; text-transform: uppercase; }}
            .card {{ background: #ffffff; border-radius: 0 0 24px 24px; border: 1px solid #e5e7eb; border-top: none; padding: 40px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
            .otp-code {{ font-size: 48px; font-weight: 800; letter-spacing: 12px; color: {accent_color}; margin: 30px 0; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; }}
            .portal-tag {{ display: inline-block; padding: 4px 12px; background-color: {accent_color}20; color: {accent_color}; border-radius: 99px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="banner">
                <img src="{LOGO_URL}" alt="FinWatch Zambia" class="logo">
            </div>
            <div class="card">
                <div class="portal-tag">{portal_name}</div>
                <h3 style="margin-top: 0; font-size: 20px; color: #111827;">Verify your identity</h3>
                <p style="color: #4b5563;">Use the verification code below to complete your authentication process:</p>
                <div class="otp-code">{otp}</div>
                <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">This code will expire in <strong>5 minutes</strong>. <br>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 FinWatch Zambia. All rights reserved.<br>Lusaka, Zambia</p>
            </div>
        </div>
    </body>
    </html>
    """


def send_via_resend(email: str, otp: str, portal_type: str) -> bool:
    """Send OTP via Resend API (HTTP). Bypasses SMTP port restrictions."""
    try:
        portal_label = "SME" if portal_type == "sme" else "Institutional"
        html_content = get_otp_template(otp, portal_type)

        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.FROM_EMAIL,
                    "to": [email],
                    "subject": f"{otp} is your FinWatch {portal_label} code",
                    "html": html_content,
                },
            )

        if response.status_code in [200, 201]:
            logger.info("Verification email sent to %s via Resend API", email)
            return True
        else:
            logger.error(
                "Resend API failed (%d): %s", response.status_code, response.text
            )
            return False
    except Exception as e:
        logger.error("Failed to send email via Resend API: %s", str(e))
        return False


def send_via_bridge(email: str, otp: str, portal_type: str) -> bool:
    """Send OTP via an HTTP Bridge (e.g. Google Apps Script). Bypasses all port blocks."""
    try:
        portal_label = "SME" if portal_type == "sme" else "Institutional"
        html_content = get_otp_template(otp, portal_type)

        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.post(
                settings.EMAIL_BRIDGE_URL,
                json={
                    "recipient": email,
                    "subject": f"{otp} is your FinWatch {portal_label} code",
                    "html": html_content,
                    "otp": otp,
                },
            )

        if response.status_code == 200:
            logger.info("Verification email sent to %s via HTTP Bridge", email)
            return True
        else:
            logger.error(
                "Email Bridge failed (%d): %s", response.status_code, response.text
            )
            return False
    except Exception as e:
        logger.error("Failed to send email via HTTP Bridge: %s", str(e))
        return False


def send_verification_email(email: str, otp: str, portal_type: str):
    """Send an OTP email using the best available method."""
    email = email.lower().strip()

    # Skip sending for demo/special domains that use fixed environment-locked codes
    if email.endswith("@gov.zm") or email.endswith("@email.com"):
        logger.info("Skipping SMTP delivery for demo domain: %s. OTP: %s", email, otp)
        return True

    # 1. Try HTTP Bridge first (Best for Cloud/Render - No Port Blocks)
    if settings.EMAIL_BRIDGE_URL:
        if send_via_bridge(email, otp, portal_type):
            return True

    # 2. Try Resend API (HTTP)
    if settings.RESEND_API_KEY:
        if send_via_resend(email, otp, portal_type):
            return True

    # 3. Try SMTP (Gmail) - Note: Often blocked on Cloud Free Tiers
    try:
        # Check if config is set
        if not settings.EMAIL_USER or not settings.EMAIL_PASSWORD:
            logger.warning(
                "SMTP credentials not configured. OTP for %s: %s",
                email,
                otp,
            )
            return False

        # Create message
        msg = MIMEMultipart("alternative")
        portal_label = "SME" if portal_type == "sme" else "Institutional"
        msg["Subject"] = f"{otp} is your FinWatch {portal_label} code"
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = email

        html_content = get_otp_template(otp, portal_type)
        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect and send
        if settings.EMAIL_PORT == 465:
            with smtplib.SMTP_SSL(
                settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=15
            ) as server:
                server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(
                settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=15
            ) as server:
                server.starttls()  # Secure the connection
                server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
                server.send_message(msg)

        logger.info("Verification email sent to %s via SMTP", email)
        return True
    except Exception as e:
        logger.error(
            "Failed to send verification email to %s: %s. OTP is: %s",
            email,
            str(e),
            otp,
        )
        return False
