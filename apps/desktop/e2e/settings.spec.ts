import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/settings');
  });

  test('should navigate to settings page', async ({ page }) => {
    await expect(page).toHaveURL(/#\/settings/);
  });

  test('should display settings header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
    await expect(page.getByText('Curator Desktop 연결 및 동기화 설정을 관리합니다.')).toBeVisible();
  });

  test('should display API configuration section', async ({ page }) => {
    await expect(page.getByText('api configuration')).toBeVisible();
    await expect(page.getByPlaceholder('https://api.internal.example')).toBeVisible();
    await expect(page.getByPlaceholder('sk-...')).toBeVisible();
    await expect(page.getByPlaceholder('gpt-4.1-mini')).toBeVisible();
  });

  test('should display Confluence section', async ({ page }) => {
    await expect(page.getByText('confluence', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('ENG')).toBeVisible();
  });

  test('should have save button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '설정 저장' })).toBeVisible();
  });

  test('should allow filling in settings fields', async ({ page }) => {
    const apiUrl = page.getByPlaceholder('https://api.internal.example');
    await apiUrl.fill('https://api.test.example.com');
    await expect(apiUrl).toHaveValue('https://api.test.example.com');

    const apiKey = page.getByPlaceholder('sk-...');
    await apiKey.fill('sk-test-key-123');
    await expect(apiKey).toHaveValue('sk-test-key-123');

    const model = page.getByPlaceholder('gpt-4.1-mini');
    await model.fill('gpt-4.1');
    await expect(model).toHaveValue('gpt-4.1');
  });

  test('should take full page screenshot', async ({ page }) => {
    // Fill in sample data for screenshot
    await page.getByPlaceholder('https://api.internal.example').fill('https://api.internal.example.com');
    await page.getByPlaceholder('gpt-4.1-mini').fill('gpt-4.1-mini');
    await page.getByPlaceholder('ENG').fill('ENGINEERING');

    await page.screenshot({ path: 'e2e/screenshots/settings-page.png', fullPage: true });
  });
});
