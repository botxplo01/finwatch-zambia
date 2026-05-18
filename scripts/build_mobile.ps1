# FinWatch Zambia - Mobile Build Script (Windows)

# 1. Build the Next.js project as a static site
cd frontend
npm run build

# 2. Sync the built files into the Android project
npx cap sync android

# 3. Open the project in Android Studio
# Note: Ensure Android Studio is installed and configured.
Write-Host "Build and Sync complete. Opening Android Studio..." -ForegroundColor Green
npx cap open android
