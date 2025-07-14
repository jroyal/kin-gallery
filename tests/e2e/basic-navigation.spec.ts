import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {
  test('should load home page and show authentication', async ({ page }) => {
    await page.goto('/');

    // Should show either authentication prompt or main app
    const hasAuthPrompt = await page.locator('text=Authentication Required').isVisible().catch(() => false);
    const hasBottomNav = await page.locator('nav').isVisible().catch(() => false);

    // One of these should be true
    expect(hasAuthPrompt || hasBottomNav).toBe(true);
  });

  test('should show development authentication when simulated', async ({ page }) => {
    await page.goto('/?simulate_user=dev@example.com');

    // Should show the main app with bottom navigation
    await expect(page.locator('nav')).toBeVisible();
    
    // Should have the expected navigation items
    await expect(page.locator('text=Album')).toBeVisible();
    await expect(page.locator('text=Recents')).toBeVisible();
    await expect(page.locator('text=Add')).toBeVisible();
    await expect(page.locator('text=Photos')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should navigate between main sections', async ({ page }) => {
    await page.goto('/?simulate_user=dev@example.com');

    // Click on Recents
    await page.click('text=Recents');
    await expect(page).toHaveURL(/.*\/recents/);

    // Click on All Photos  
    await page.click('text=Photos');
    await expect(page).toHaveURL(/.*\/all-photos/);

    // Click on Upload
    await page.click('text=Add');
    await expect(page).toHaveURL(/.*\/upload/);

    // Navigate back to home
    await page.click('text=Album');
    await expect(page).toHaveURL(/.*\//);
  });

  test('should show upload interface when authenticated', async ({ page }) => {
    await page.goto('/upload?simulate_user=dev@example.com');

    // Should show upload form
    await expect(page.locator('text=Upload Photos & Videos')).toBeVisible();
    await expect(page.locator('text=Choose Files')).toBeVisible();
    await expect(page.locator('text=Select Child')).toBeVisible();
  });

  test('should require authentication for upload', async ({ page }) => {
    await page.goto('/upload');

    // Should show authentication required message
    await expect(page.locator('text=Authentication Required')).toBeVisible();
    await expect(page.locator('text=Please sign in to upload')).toBeVisible();
  });
});