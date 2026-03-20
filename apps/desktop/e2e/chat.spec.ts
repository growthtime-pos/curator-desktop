import { expect, test } from '@playwright/test';

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('redirects to the chat page by default', async ({ page }) => {
    await expect(page).toHaveURL(/#\/chat/);
  });

  test('renders navigation and bootstraps a chat session', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('nav').getByText('Curator', { exact: true })).toBeVisible();
    await expect(page.getByText('OpenAI-compatible chat')).toBeVisible();
    await expect(page.getByText(/backend:/)).toBeVisible();
    await expect(page.getByText('active: none')).toBeVisible();
  });

  test('recommends and activates a skill before sending a message', async ({ page }) => {
    const input = page.getByPlaceholder(
      'Ask for release notes, Confluence help, or use Workspace Toolkit to inspect the repo.',
    );
    await input.fill('Use Workspace Toolkit to show me the repository files');

    await expect(page.getByRole('button', { name: /Workspace Toolkit/ })).toBeVisible();
    await page.getByRole('button', { name: /Workspace Toolkit/ }).click();

    await expect(page.getByText('Activate a recommended skill')).not.toBeVisible();
    await expect(page.getByText('active: Workspace Toolkit')).toBeVisible();
  });

  test('sends a message and shows applied skill traces', async ({ page }) => {
    const input = page.getByPlaceholder(
      'Ask for release notes, Confluence help, or use Workspace Toolkit to inspect the repo.',
    );
    await input.fill('Use Workspace Toolkit to show me the repository files');
    await page.getByRole('button', { name: /Workspace Toolkit/ }).click();

    await input.fill('Please inspect the workspace files now');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Please inspect the workspace files now', { exact: true })).toBeVisible();
    await expect(page.getByText('Tool executed: list_workspace_overview')).toBeVisible();
    await expect(page.getByText('skill: Workspace Toolkit')).toBeVisible();
  });

  test('takes a full page screenshot', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/chat-page.png', fullPage: true });
  });
});
