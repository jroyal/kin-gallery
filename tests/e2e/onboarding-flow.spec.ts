import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe('Clean Install & Onboarding Flow', () => {
  
  test.beforeEach(async () => {
    // Run clean install before each test to ensure clean state
    try {
      execSync('npm run clean-install', { 
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn('Clean install script may not be available in CI:', error);
    }
  });

  test('should complete full onboarding flow for first user', async ({ page }) => {
    // Step 1: First user should be redirected to onboarding
    await page.goto('/?simulate_user=admin@example.com');
    
    // Should redirect to onboarding page
    await expect(page).toHaveURL(/.*\/onboarding/);
    
    // Should show welcome message
    await expect(page.locator('text=Welcome to KinGallery')).toBeVisible();
    await expect(page.locator('text=admin@example.com')).toBeVisible();
    await expect(page.locator('text=automatically made an admin')).toBeVisible();

    // Step 2: Fill out onboarding form
    await page.fill('input[name="children[0][name]"]', 'Emma');
    await page.fill('input[name="children[0][birthdate]"]', '2020-05-15');

    // Add a second child
    await page.click('text=Add Another Child');
    await page.fill('input[name="children[1][name]"]', 'Alex');
    await page.fill('input[name="children[1][birthdate]"]', '2018-03-22');

    // Submit onboarding
    await page.click('text=Complete Setup');

    // Step 3: Should redirect to main app after onboarding
    await expect(page).toHaveURL(/^.*\/$|.*\/\?.*$/);
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Album')).toBeVisible();
  });

  test('should prevent duplicate onboarding', async ({ page }) => {
    // Complete onboarding first
    await page.goto('/onboarding?simulate_user=admin@example.com');
    await page.fill('input[name="children[0][name]"]', 'Test Child');
    await page.click('text=Complete Setup');
    
    // Wait for redirect
    await page.waitForURL(/^.*\/$|.*\/\?.*$/);

    // Try to access onboarding again - should redirect to main app
    await page.goto('/onboarding?simulate_user=admin@example.com');
    await expect(page).toHaveURL(/^.*\/$|.*\/\?.*$/);
  });

  test('should show main app for subsequent users after onboarding', async ({ page }) => {
    // Complete onboarding with first user
    await page.goto('/onboarding?simulate_user=admin@example.com');
    await page.fill('input[name="children[0][name]"]', 'Test Child');
    await page.click('text=Complete Setup');
    await page.waitForURL(/^.*\/$|.*\/\?.*$/);

    // Second user should go directly to main app
    await page.goto('/?simulate_user=user@example.com');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Album')).toBeVisible();
    
    // Should NOT be redirected to onboarding
    await expect(page).not.toHaveURL(/.*\/onboarding/);
  });

  test('should require authentication for onboarding page', async ({ page }) => {
    await page.goto('/onboarding');
    
    // Should redirect to home page without authentication
    await expect(page).toHaveURL(/^.*\/$|.*\/\?.*$/);
    await expect(page.locator('text=Development Status')).toBeVisible();
  });

  test('should validate onboarding form inputs', async ({ page }) => {
    await page.goto('/onboarding?simulate_user=admin@example.com');

    // Try to submit without filling required fields
    await page.click('text=Complete Setup');

    // Should show HTML5 validation errors (empty required field)
    const nameInput = page.locator('input[name="children[0][name]"]');
    await expect(nameInput).toBeVisible();
    
    // Fill only name (birthdate is optional)
    await page.fill('input[name="children[0][name]"]', 'Valid Name');
    await page.click('text=Complete Setup');

    // Should complete successfully and redirect
    await expect(page).toHaveURL(/^.*\/$|.*\/\?.*$/, { timeout: 10000 });
  });

  test('should handle onboarding API errors gracefully', async ({ page }) => {
    await page.goto('/onboarding?simulate_user=admin@example.com');

    // Mock a failed API response
    await page.route('/api/onboarding', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database error' })
      });
    });

    await page.fill('input[name="children[0][name]"]', 'Test Child');
    await page.click('text=Complete Setup');

    // Should show error message
    await expect(page.locator('text=Database error')).toBeVisible();
    
    // Should still be on onboarding page
    await expect(page).toHaveURL(/.*\/onboarding/);
  });
});

test.describe('Post-Onboarding Smoke Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set up a basic onboarded state
    try {
      execSync('npm run clean-install', { 
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn('Clean install script may not be available in CI:', error);
    }

    // Complete onboarding
    await page.goto('/onboarding?simulate_user=admin@example.com');
    await page.fill('input[name="children[0][name]"]', 'Emma');
    await page.click('text=Complete Setup');
    await page.waitForURL(/^.*\/$|.*\/\?.*$/);
  });

  test('should navigate to upload page after onboarding', async ({ page }) => {
    // Navigate to upload
    await page.click('text=Add');
    await expect(page).toHaveURL(/.*\/upload/);
    
    // Should show upload interface
    await expect(page.locator('text=Upload Photos & Videos')).toBeVisible();
    await expect(page.locator('text=Emma')).toBeVisible(); // Should show child from onboarding
  });

  test('should show children in navigation after onboarding', async ({ page }) => {
    // The main page should now show the child we added
    await expect(page.locator('text=Emma')).toBeVisible();
  });

  test('should access recents feed after onboarding', async ({ page }) => {
    await page.click('text=Recents');
    await expect(page).toHaveURL(/.*\/recents/);
    
    // Should show recents interface (even if empty)
    await expect(page.locator('text=Recent Activity')).toBeVisible();
  });

  test('should access all photos after onboarding', async ({ page }) => {
    await page.click('text=Photos');
    await expect(page).toHaveURL(/.*\/all-photos/);
    
    // Should show photos interface (even if empty)
    await expect(page.locator('text=All Photos')).toBeVisible();
  });
});