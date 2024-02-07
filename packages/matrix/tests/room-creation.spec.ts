import { expect, test } from '@playwright/test';
import { registerUser } from '../docker/synapse';
import {
  synapseStart,
  synapseStop,
  type SynapseInstance,
} from '../docker/synapse';
import {
  login,
  logout,
  assertRooms,
  createRoom,
  openRoom,
  openRenameMenu,
  reloadAndOpenAiAssistant,
  registerRealmUsers,
} from '../helpers';

test.describe('Room creation', () => {
  let synapse: SynapseInstance;
  test.beforeEach(async () => {
    synapse = await synapseStart();
    await registerRealmUsers(synapse);
    await registerUser(synapse, 'user1', 'pass');
    await registerUser(synapse, 'user2', 'pass');
  });
  test.afterEach(async () => {
    await synapseStop(synapse.synapseId);
  });

  test('it can create a room', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await assertRooms(page, []);

    let name = await createRoom(page);
    await assertRooms(page, [name]);

    await reloadAndOpenAiAssistant(page);
    await assertRooms(page, [name]);

    await logout(page);
    await login(page, 'user1', 'pass');
    await assertRooms(page, [name]);

    // user2 should not be able to see user1's room
    await logout(page);
    await login(page, 'user2', 'pass');
    await assertRooms(page, []);
  });

  test('it can rename a room', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await assertRooms(page, []);

    let room1 = await createRoom(page);
    let room2 = await createRoom(page);
    await assertRooms(page, [room1, room2]);

    await openRenameMenu(page, room1);
    await expect(page.locator('[data-test-rename-session]')).toHaveCount(1);
    await expect(page.locator('[data-test-past-sessions]')).toHaveCount(0);
    let name = await page.locator(`[data-test-name-field]`).inputValue();
    expect(name).toEqual(room1);
    await expect(page.locator(`[data-test-save-name-button]`)).toBeDisabled();
    await expect(page.locator(`[data-test-cancel-name-button]`)).toBeEnabled();

    const newRoom1 = 'Room 1';
    await page.locator(`[data-test-name-field]`).fill(newRoom1);
    name = await page.locator(`[data-test-name-field]`).inputValue();
    expect(name).toEqual(newRoom1);
    await expect(page.locator(`[data-test-save-name-button]`)).toBeEnabled();
    await page.locator('[data-test-save-name-button]').click();

    await expect(page.locator('[data-test-rename-session]')).toHaveCount(0);
    await expect(page.locator('[data-test-past-sessions]')).toHaveCount(0);
    await assertRooms(page, [newRoom1, room2]);

    await openRoom(page, newRoom1);
    await expect(page.locator(`[data-test-room-name]`)).toHaveText(newRoom1);

    await reloadAndOpenAiAssistant(page);
    await assertRooms(page, [newRoom1, room2]);

    await logout(page);
    await login(page, 'user1', 'pass');
    await assertRooms(page, [newRoom1, room2]);
  });

  test('it can cancel renaming a room', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await assertRooms(page, []);

    let room1 = await createRoom(page);
    let room2 = await createRoom(page);
    await assertRooms(page, [room1, room2]);

    await openRenameMenu(page, room1);
    const newName = 'Room 1';
    await page.locator(`[data-test-name-field]`).fill(newName);
    expect(await page.locator(`[data-test-name-field]`).inputValue()).toEqual(
      newName,
    );
    await page.locator('[data-test-cancel-name-button]').click();
    await expect(page.locator(`[data-test-past-sessions]`)).toHaveCount(0);
    await expect(page.locator(`[data-test-rename-session]`)).toHaveCount(0);
    await assertRooms(page, [room1, room2]);

    await page.locator(`[data-test-past-sessions-button]`).click();
    await page
      .locator(`[data-test-past-session-options-button="${room1}"]`)
      .click();
    await expect(
      page.locator(`[data-test-boxel-menu-item-text="Rename"]`),
    ).toHaveCount(1);
    await page.locator(`[data-test-boxel-menu-item-text="Rename"]`).click();
    let name = await page.locator('[data-test-name-field]').inputValue();
    expect(name).not.toEqual(newName);
    expect(name).toEqual(room1);
    await expect(page.locator('[data-test-save-name-button]')).toBeDisabled();
  });

  test('rooms are sorted by join date', async ({ page }) => {
    await login(page, 'user1', 'pass');
    let room1 = await createRoom(page);
    let room2 = await createRoom(page);
    await assertRooms(page, [room1, room2]);

    await openRenameMenu(page, room1);
    await page.locator(`[data-test-name-field]`).fill('Room Z');
    await page.locator('[data-test-save-name-button]').click();
    await expect(page.locator(`[data-test-past-sessions]`)).toHaveCount(0);
    await expect(page.locator(`[data-test-rename-session]`)).toHaveCount(0);

    await openRenameMenu(page, room2);
    await page.locator(`[data-test-name-field]`).fill('Room A');
    await page.locator('[data-test-save-name-button]').click();

    await assertRooms(page, ['Room Z', 'Room A']);
  });
});
