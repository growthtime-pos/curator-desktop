import { test, expect } from '@playwright/test';

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to chat page by default', async ({ page }) => {
    await expect(page).toHaveURL(/#\/chat/);
  });

  test('should display navigation with Curator branding', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('nav').getByText('Curator', { exact: true })).toBeVisible();
    await expect(page.getByText('> chat')).toBeVisible();
    await expect(page.getByText('> settings')).toBeVisible();
  });

  test('should display sidebar with conversation list', async ({ page }) => {
    await expect(page.getByText('conversations')).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confluence Sync' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release Note Draft' })).toBeVisible();
  });

  test('should display initial messages', async ({ page }) => {
    await expect(page.getByText('Curator Assistant 준비 완료')).toBeVisible();
    await expect(page.getByText('무엇을 도와드릴까요?')).toBeVisible();
  });

  test('should display status badges in header', async ({ page }) => {
    await expect(page.locator('header').getByText('backend', { exact: true })).toBeVisible();
    await expect(page.locator('header').getByText('connected')).toBeVisible();
  });

  test('should have input area with prompt symbol', async ({ page }) => {
    await expect(page.getByPlaceholder('메시지를 입력하세요...')).toBeVisible();
    await expect(page.getByText('Enter로 전송')).toBeVisible();
  });

  test('send button should be disabled when input is empty', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: '전송' });
    await expect(sendButton).toBeDisabled();
  });

  test('should enable send button when text is entered', async ({ page }) => {
    const input = page.getByPlaceholder('메시지를 입력하세요...');
    await input.fill('테스트 메시지');

    const sendButton = page.getByRole('button', { name: '전송' });
    await expect(sendButton).toBeEnabled();
  });

  test('should send message and receive response', async ({ page }) => {
    const input = page.getByPlaceholder('메시지를 입력하세요...');
    await input.fill('릴리스 노트 작성해줘');
    await page.getByRole('button', { name: '전송' }).click();

    // User message should appear
    await expect(page.getByText('릴리스 노트 작성해줘')).toBeVisible();

    // Wait for streaming response to complete
    await expect(page.getByText('초안을 생성했습니다.')).toBeVisible({ timeout: 15_000 });

    // Input should be cleared
    await expect(input).toHaveValue('');
  });

  test('should switch active conversation in sidebar', async ({ page }) => {
    await page.getByRole('button', { name: 'Confluence Sync' }).click();
    await expect(page.locator('header').getByText('Confluence Sync')).toBeVisible();
  });

  test('should take full page screenshot', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/chat-page.png', fullPage: true });
  });
});
