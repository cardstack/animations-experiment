import { expect, test } from '@playwright/test';
import {
  synapseStart,
  synapseStop,
  registerUser,
  type SynapseInstance,
} from '../docker/synapse';
import {
  login,
  logout,
  createRoom,
  openRoom,
  assertMessages,
  sendMessage,
  joinRoom,
  scrollToTopOfMessages,
  leaveRoom,
} from '../helpers';

test.describe('Room messages', () => {
  let synapse: SynapseInstance;
  test.beforeEach(async () => {
    synapse = await synapseStart();
    await registerUser(synapse, 'user1', 'pass');
    await registerUser(synapse, 'user2', 'pass');
  });

  test.afterEach(async () => {
    await synapseStop(synapse.synapseId);
  });

  test(`it can send a message in a room`, async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, { name: 'Room 1' });
    await createRoom(page, { name: 'Room 2' });
    await openRoom(page, 'Room 1');

    await expect(page.locator('[data-test-timeline-start]')).toHaveCount(1);
    await expect(page.locator('[data-test-no-messages]')).toHaveCount(1);
    await assertMessages(page, []);

    await expect(page.locator('[data-test-send-message-btn]')).toBeDisabled();
    await page.locator('[data-test-message-field]').fill('Message 1');
    await expect(page.locator('[data-test-send-message-btn]')).toBeEnabled();
    await page.locator('[data-test-send-message-btn]').click();

    await expect(page.locator('[data-test-no-messages]')).toHaveCount(0);
    await assertMessages(page, [{ from: 'user1', message: 'Message 1' }]);

    await page.reload();
    await openRoom(page, 'Room 1');
    await assertMessages(page, [{ from: 'user1', message: 'Message 1' }]);

    await logout(page);
    await login(page, 'user1', 'pass');
    await openRoom(page, 'Room 1');
    await assertMessages(page, [{ from: 'user1', message: 'Message 1' }]);

    // make sure that room state doesn't leak
    await openRoom(page, 'Room 2');
    await assertMessages(page, []);

    await openRoom(page, 'Room 1');
    await assertMessages(page, [{ from: 'user1', message: 'Message 1' }]);
  });

  test(`it lets multiple users send messages in a room`, async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, {
      name: 'Room 1',
      invites: ['user2'],
    });
    await openRoom(page, 'Room 1');
    await sendMessage(page, 'first message');
    await logout(page);

    await login(page, 'user2', 'pass');
    await joinRoom(page, 'Room 1');
    await openRoom(page, 'Room 1');

    await assertMessages(page, [{ from: 'user1', message: 'first message' }]);
    await sendMessage(page, 'second message');
    await assertMessages(page, [
      { from: 'user1', message: 'first message' },
      { from: 'user2', message: 'second message' },
    ]);

    await page.reload();
    await openRoom(page, 'Room 1');
    await assertMessages(page, [
      { from: 'user1', message: 'first message' },
      { from: 'user2', message: 'second message' },
    ]);

    await logout(page);
    await login(page, 'user1', 'pass');
    await openRoom(page, 'Room 1');
    await assertMessages(page, [
      { from: 'user1', message: 'first message' },
      { from: 'user2', message: 'second message' },
    ]);
  });

  test(`it can paginate back to beginning of timeline for timelines that truncated`, async ({
    page,
  }) => {
    // generally the matrix server paginates after 10 messages
    const totalMessageCount = 20;

    await login(page, 'user1', 'pass');
    await createRoom(page, {
      name: 'Room 1',
      invites: ['user2'],
    });
    await openRoom(page, 'Room 1');

    for (let i = 1; i <= totalMessageCount; i++) {
      await sendMessage(page, `message ${i}`);
      await page.waitForTimeout(100);
    }
    await logout(page);

    await login(page, 'user2', 'pass');
    await joinRoom(page, 'Room 1');
    await openRoom(page, 'Room 1');

    let displayedMessageCount = await page
      .locator('[data-test-message-idx]')
      .count();
    expect(displayedMessageCount).toBeGreaterThan(0);
    expect(displayedMessageCount).toBeLessThan(totalMessageCount);
    await expect(
      page.locator('[data-test-timeline-start]'),
      'the beginning of the timeline is not displayed'
    ).toHaveCount(0);
    await expect(
      page.getByText(`message ${totalMessageCount}`),
      'the most recent message is displayed'
    ).toHaveCount(1);

    await scrollToTopOfMessages(page);
    await expect(page.locator('[data-test-message-idx]')).toHaveCount(
      totalMessageCount
    );
    expect(displayedMessageCount).toBeLessThan(totalMessageCount);
    await expect(
      page.locator('[data-test-timeline-start]'),
      'the beginning of the timeline is displayed'
    ).toHaveCount(1);
  });

  test(`it can send a markdown message`, async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, {
      name: 'Room 1',
    });
    await openRoom(page, 'Room 1');
    await sendMessage(page, 'message with _style_');
    await assertMessages(page, [
      {
        from: 'user1',
        message: 'message with style',
      },
    ]);
    await expect(
      page.locator(`[data-test-message-idx="0"] .boxel-message__content em`)
    ).toContainText('style');
  });

  test(`it can create a room specific pending message`, async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, { name: 'Room 1' });
    await createRoom(page, { name: 'Room 2' });
    await openRoom(page, 'Room 1');

    await page.locator('[data-test-message-field]').fill('room 1 message');
    await openRoom(page, 'Room 2');
    await expect(page.locator('[data-test-message-field]')).toHaveValue('');
    await page.locator('[data-test-message-field]').fill('room 2 message');
    await openRoom(page, 'Room 1');
    await expect(page.locator('[data-test-message-field]')).toHaveValue(
      'room 1 message'
    );
    await openRoom(page, 'Room 2');
    await expect(page.locator('[data-test-message-field]')).toHaveValue(
      'room 2 message'
    );
  });

  test('message sender has left room', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, {
      name: 'Room 1',
      invites: ['user2'],
    });
    await logout(page);

    await login(page, 'user2', 'pass');
    await joinRoom(page, 'Room 1');
    await openRoom(page, 'Room 1');
    await sendMessage(page, 'first message');
    await leaveRoom(page, 'Room 1');

    await logout(page);
    await login(page, 'user1', 'pass');
    await openRoom(page, 'Room 1');

    await assertMessages(page, [
      { from: 'user2 (left room)', message: 'first message' },
    ]);
  });
});
