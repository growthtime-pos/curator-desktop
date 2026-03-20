import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test('navigates between chat and settings', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/#\/chat/);
    await page.getByText('> settings').click();
    await expect(page).toHaveURL(/#\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.getByText('> chat').click();
    await expect(page).toHaveURL(/#\/chat/);
    await expect(page.getByText('OpenAI-compatible chat')).toBeVisible();
  });

  test('highlights the active nav link', async ({ page }) => {
    await page.goto('/#/chat');

    const chatLink = page.getByText('> chat');
    const settingsLink = page.getByText('> settings');

    await expect(chatLink).toHaveCSS('color', 'rgb(218, 119, 86)');
    await settingsLink.click();
    await expect(settingsLink).toHaveCSS('color', 'rgb(218, 119, 86)');
  });
});
