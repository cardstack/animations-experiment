import { expect, type Page } from '@playwright/test';

export const testHost = 'http://localhost:4202/test';
export const rootPath =
  new URL(testHost).pathname === '/' ? '' : new URL(testHost).pathname;

interface ProfileAssertions {
  userId?: string;
  displayName?: string;
}
interface LoginOptions {
  expectFailure?: true;
}

export async function login(
  page: Page,
  username: string,
  password: string,
  opts?: LoginOptions
) {
  await page.goto(`${rootPath}/chat`);
  await page.locator('[data-test-username-field]').fill(username);
  await page.locator('[data-test-password-field]').fill(password);
  await page.locator('[data-test-login-btn]').click();

  if (opts?.expectFailure) {
    await expect(page.locator('[data-test-login-error]')).toHaveCount(1);
  } else {
    await expect(page.locator('[data-test-rooms-list]')).toHaveCount(1);
  }
}

export async function logout(page: Page) {
  await page.locator('[data-test-logout-btn]').click();
  await expect(page.locator('[data-test-login-btn]')).toHaveCount(1);
}

export async function createRoom(
  page: Page,
  roomDetails: { name: string; invites?: string[] }
) {
  await page.locator('[data-test-create-room-mode-btn]').click();
  await page.locator('[data-test-room-name-field]').fill(roomDetails.name);
  if (roomDetails.invites && roomDetails.invites.length > 0) {
    await page
      .locator('[data-test-room-invite-field]')
      .fill(roomDetails.invites.join(', '));
  }
  await page.locator('[data-test-create-room-btn]').click();
}

export async function joinRoom(page: Page, roomName: string) {
  await page.locator(`[data-test-join-room-btn="${roomName}"]`).click();
}

export async function leaveRoom(page: Page, roomName: string) {
  await page.locator(`[data-test-leave-room-btn="${roomName}"]`).click();
}

export async function openRoom(page: Page, roomName: string) {
  await page.locator(`[data-test-enter-room="${roomName}"]`).click();
}

export async function setObjective(page: Page, objectiveURI: string) {
  await page.locator(`[data-test-set-objective-btn]`).click();
  await page.locator(`[data-test-select="${objectiveURI}"]`).click();
  await expect(page.locator(`[data-test-objective]`)).toHaveCount(1);
}

export async function sendMessage(
  page: Page,
  message: string | undefined,
  cardId?: string
) {
  if (message == null && cardId == null) {
    throw new Error(
      `sendMessage requires at least a message or a card ID be specified`
    );
  }
  if (message != null) {
    await page.locator('[data-test-message-field]').fill(message);
  }
  if (cardId != null) {
    await page.locator('[data-test-choose-card-btn]').click();
    await page.locator(`[data-test-select="${cardId}"]`).click();
  }
  await page.locator('[data-test-send-message-btn]').click();
}

export async function inviteToRoom(page: Page, invites: string[]) {
  await page.locator(`[data-test-invite-mode-btn]`).click();
  await page.locator('[data-test-room-invite-field]').fill(invites.join(', '));
  await page.locator('[data-test-room-invite-btn]').click();
}

export async function scrollToTopOfMessages(page: Page) {
  await page.evaluate(() => {
    let messages = document.querySelector('.room__messages-wrapper');
    if (!messages) {
      throw new Error(`Can't find messages element`);
    }
    messages.scrollTop = 0;
  });
}

export async function assertMessages(
  page: Page,
  messages: {
    from: string;
    message?: string;
    card?: { id: string; text?: string };
  }[]
) {
  await expect(page.locator('[data-test-message-idx]')).toHaveCount(
    messages.length
  );
  for (let [index, { from, message, card }] of messages.entries()) {
    await expect(
      page.locator(
        `[data-test-message-idx="${index}"] [data-test-boxel-message-name]`
      )
    ).toContainText(from);
    if (message != null) {
      await expect(
        page.locator(`[data-test-message-idx="${index}"] .content`)
      ).toContainText(message);
    }
    if (card) {
      await expect(
        page.locator(
          `[data-test-message-idx="${index}"][data-test-message-card="${card.id}"]`
        )
      ).toHaveCount(1);
      if (card.text) {
        if (message != null && card.text.includes(message)) {
          throw new Error(
            `This is not a good test since the message '${message}' overlaps with the asserted card text '${card.text}'`
          );
        }
        await expect(
          page.locator(
            `[data-test-message-idx="${index}"][data-test-message-card="${card.id}"]`
          )
        ).toContainText(card.text);
      }
    } else {
      await expect(
        page.locator(
          `[data-test-message-idx="${index}"][data-test-message-card]`
        )
      ).toHaveCount(0);
    }
  }
}

interface RoomAssertions {
  joinedRooms?: { name: string }[];
  invitedRooms?: { name: string; sender: string }[];
}

export async function assertRooms(page: Page, rooms: RoomAssertions) {
  if (rooms.joinedRooms && rooms.joinedRooms.length > 0) {
    await page.waitForFunction(
      (rooms: RoomAssertions) =>
        document.querySelectorAll('[data-test-joined-room]').length ===
        rooms.joinedRooms!.length,
      rooms
    );
    for (let { name } of rooms.joinedRooms) {
      await expect(
        page.locator(`[data-test-joined-room="${name}"]`),
        `the joined room '${name}' is displayed`
      ).toHaveCount(1);
    }
  } else {
    await expect(
      page.locator('[data-test-joined-room]'),
      `joined rooms are not displayed`
    ).toHaveCount(0);
  }
  if (rooms.invitedRooms && rooms.invitedRooms.length > 0) {
    await page.waitForFunction(
      (rooms: RoomAssertions) =>
        document.querySelectorAll('[data-test-invited-room]').length ===
        rooms.invitedRooms!.length,
      rooms
    );
    for (let { name, sender } of rooms.invitedRooms) {
      await expect(
        page.locator(
          `[data-test-invited-room="${name}"] [data-test-invite-sender="${sender}"]`
        ),
        `the invited room '${name}' from '${sender}' is displayed`
      ).toHaveCount(1);
    }
  } else {
    await expect(
      page.locator('[data-test-invited-room]'),
      `invited rooms are not displayed`
    ).toHaveCount(0);
  }
}

export async function assertLoggedIn(page: Page, opts?: ProfileAssertions) {
  await page.waitForURL(`${testHost}/chat`);
  await expect(
    page.locator('[data-test-username-field]'),
    'username field is not displayed'
  ).toHaveCount(0);
  await expect(
    page.locator('[data-test-password-field]'),
    'password field is not displayed'
  ).toHaveCount(0);
  await expect(page.locator('[data-test-field-value="userId"]')).toContainText(
    opts?.userId ?? '@user1:localhost'
  );
  await expect(
    page.locator('[data-test-field-value="displayName"]')
  ).toContainText(opts?.displayName ?? 'user1');
}

export async function assertLoggedOut(page: Page) {
  await page.waitForURL(`${testHost}/chat`);
  await expect(
    page.locator('[data-test-username-field]'),
    'username field is displayed'
  ).toHaveCount(1);
  await expect(
    page.locator('[data-test-password-field]'),
    'password field is displayed'
  ).toHaveCount(1);
  await expect(
    page.locator('[data-test-field-value="userId"]'),
    'user profile - user ID is not displayed'
  ).toHaveCount(0);
  await expect(
    page.locator('[data-test-field-value="displayName"]'),
    'user profile - display name is not displayed'
  ).toHaveCount(0);
}
