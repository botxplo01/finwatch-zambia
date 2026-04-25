import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error message on failed login', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[id="identifier"]', 'wrong@email.com');
    await page.fill('input[id="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Check for error message
    const errorMsg = page.locator('p.text-red-600');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/Invalid username or password/);
  });

  test('should allow user to toggle theme', async ({ page }) => {
    await page.goto('/login');
    
    // Default is light (bg-white)
    const body = page.locator('body');
    
    // Find theme toggle button (Moon icon indicates light mode active)
    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await themeToggle.click();
    
    // Check if dark class is applied (next-themes usually puts it on <html>)
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });
});
