# FinWatch Zambia - Mobile Resources

Place your app icons and splash screens in this directory. Capacitor uses these to generate all required Android and iOS assets.

## Required Assets

### 1. App Icon (`icon.png`)

- **Size**: 1024 x 1024 px
- **Format**: PNG (with transparency)
- **Safe Zone**: Keep the logo within the center 66% circle.

### 2. Splash Screens

- **Light Splash (`splash.png`)**: 2732 x 2732 px PNG
- **Dark Splash (`splash-dark.png`)**: 2732 x 2732 px PNG

## How to generate assets

Once the files are placed here, you can run the following command from the `frontend` directory:

```bash
npx capacitor-assets generate --android
```
