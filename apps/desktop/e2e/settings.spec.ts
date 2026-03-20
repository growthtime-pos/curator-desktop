import { expect, test } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/settings');
  });

  test('navigates to settings page', async ({ page }) => {
    await expect(page).toHaveURL(/#\/settings/);
  });

  test('renders provider configuration fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(
      page.getByText('Configure the OpenAI-compatible provider, protocol, and skill discovery roots for Curator Desktop.'),
    ).toBeVisible();
    await expect(page.getByPlaceholder('https://api.openai-compatible.local/v1')).toBeVisible();
    await expect(page.getByPlaceholder('sk-...')).toBeVisible();
    await expect(page.getByPlaceholder('gpt-4.1-mini')).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveValue('chat');
  });

  test('allows filling provider and skill settings', async ({ page }) => {
    await page.getByPlaceholder('https://api.openai-compatible.local/v1').fill('https://api.test.example/v1');
    await page.getByPlaceholder('sk-...').fill('sk-test-key-123');
    await page.getByPlaceholder('gpt-4.1-mini').fill('gpt-4.1');
    await page.getByRole('combobox').selectOption('responses');
    await page.getByPlaceholder('.codex/skills\nC:\\Users\\you\\.codex\\skills').fill('.codex/skills');

    await expect(page.getByPlaceholder('https://api.openai-compatible.local/v1')).toHaveValue(
      'https://api.test.example/v1',
    );
    await expect(page.getByPlaceholder('sk-...')).toHaveValue('sk-test-key-123');
    await expect(page.getByPlaceholder('gpt-4.1-mini')).toHaveValue('gpt-4.1');
    await expect(page.getByRole('combobox')).toHaveValue('responses');
  });

  test('takes a full page screenshot', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/settings-page.png', fullPage: true });
  });
});
