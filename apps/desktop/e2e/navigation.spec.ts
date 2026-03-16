import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between chat and settings', async ({ page }) => {
    await page.goto('/');

    // Should start on chat
    await expect(page).toHaveURL(/#\/chat/);

    // Navigate to settings
    await page.getByText('> settings').click();
    await expect(page).toHaveURL(/#\/settings/);
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Navigate back to chat
    await page.getByText('> chat').click();
    await expect(page).toHaveURL(/#\/chat/);
    await expect(page.getByText('무엇을 도와드릴까요?')).toBeVisible();
  });

  test('should highlight active nav link', async ({ page }) => {
    await page.goto('/#/chat');

    const chatLink = page.getByText('> chat');
    const settingsLink = page.getByText('> settings');

    // Chat should be highlighted
    await expect(chatLink).toHaveCSS('color', 'rgb(218, 119, 86)');

    // Navigate to settings
    await settingsLink.click();
    await expect(settingsLink).toHaveCSS('color', 'rgb(218, 119, 86)');
  });
});
