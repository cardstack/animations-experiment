import type Owner from '@ember/owner';
import type RouterService from '@ember/routing/router-service';
import Service, { service } from '@ember/service';
import { cached, tracked } from '@glimmer/tracking';

import format from 'date-fns/format';

import { task } from 'ember-concurrency';
import {
  type LoginResponse,
  type MatrixEvent,
  type RoomMember,
  type EmittedEvents,
  type IEvent,
  type MatrixClient,
  type ISendEventResponse,
} from 'matrix-js-sdk';
import { md5 } from 'super-fast-md5';
import { TrackedMap } from 'tracked-built-ins';

import {
  type LooseSingleCardDocument,
  markdownToHtml,
  aiBotUsername,
  splitStringIntoChunks,
  baseRealm,
  loaderFor,
  LooseCardResource,
} from '@cardstack/runtime-common';
import {
  basicMappings,
  generateCardPatchCallSpecification,
} from '@cardstack/runtime-common/helpers/ai';

import { RealmAuthClient } from '@cardstack/runtime-common/realm-auth-client';

import { currentRoomIdPersistenceKey } from '@cardstack/host/components/ai-assistant/panel';
import { Submode } from '@cardstack/host/components/submode-switcher';
import ENV from '@cardstack/host/config/environment';

import { RoomState } from '@cardstack/host/lib/matrix-model/room';
import { getMatrixProfile } from '@cardstack/host/resources/matrix-profile';

import type { Base64ImageField as Base64ImageFieldType } from 'https://cardstack.com/base/base64-image';
import { type CardDef } from 'https://cardstack.com/base/card-api';
import type * as CardAPI from 'https://cardstack.com/base/card-api';
import { PatchField } from 'https://cardstack.com/base/command';
import type {
  MatrixEvent as DiscreteMatrixEvent,
  CardMessageContent,
  CardFragmentContent,
  ReactionEventContent,
} from 'https://cardstack.com/base/matrix-event';

import {
  Timeline,
  Membership,
  addRoomEvent,
  Context,
} from '../lib/matrix-handlers';
import { importResource } from '../resources/import';

import { RoomResource, getRoom } from '../resources/room';

import RealmService from './realm';

import type CardService from './card-service';
import type LoaderService from './loader-service';

import type * as MatrixSDK from 'matrix-js-sdk';

const { matrixURL } = ENV;
const AI_BOT_POWER_LEVEL = 50; // this is required to set the room name
const DEFAULT_PAGE_SIZE = 50;
const MAX_CARD_SIZE_KB = 60;

export type Event = Partial<IEvent>;

export type OperatorModeContext = {
  submode: Submode;
  openCardIds: string[];
};

export interface ContextualService<C> {
  get context(): C;
}

export default class MatrixService
  extends Service
  implements ContextualService<Context>
{
  @service declare loaderService: LoaderService;
  @service declare cardService: CardService;
  @service declare realm: RealmService;

  @service declare router: RouterService;
  @tracked private _client: MatrixClient | undefined;
  private realmSessionTasks: Map<string, Promise<string>> = new Map(); // key: realmURL, value: promise for JWT

  profile = getMatrixProfile(this, () => this.client.getUserId());

  rooms: TrackedMap<string, RoomState> = new TrackedMap();
  roomResourcesCache: TrackedMap<string, RoomResource> = new TrackedMap();
  messagesToSend: TrackedMap<string, string | undefined> = new TrackedMap();
  cardsToSend: TrackedMap<string, CardDef[] | undefined> = new TrackedMap();
  failedCommandState: TrackedMap<string, Error> = new TrackedMap();
  flushTimeline: Promise<void> | undefined;
  flushMembership: Promise<void> | undefined;
  roomMembershipQueue: { event: MatrixEvent; member: RoomMember }[] = [];
  timelineQueue: { event: MatrixEvent; oldEventId?: string }[] = [];
  #ready: Promise<void>;
  #matrixSDK: typeof MatrixSDK | undefined;
  #eventBindings: [EmittedEvents, (...arg: any[]) => void][] | undefined;
  currentUserEventReadReceipts: TrackedMap<string, { readAt: Date }> =
    new TrackedMap();
  cardHashes: Map<string, string> = new Map(); // hashes <> event id

  constructor(owner: Owner) {
    super(owner);
    this.#ready = this.loadSDK.perform();
  }

  get context(): Context {
    return {
      cardAPI: this.cardAPI,
      flushTimeline: this.flushTimeline,
      flushMembership: this.flushMembership,
      roomMembershipQueue: this.roomMembershipQueue,
      timelineQueue: this.timelineQueue,
      client: this._client,
      matrixSDK: this.#matrixSDK,
      addEventReadReceipt: this.addEventReadReceipt,
      setRoom: this.setRoom,
      getRoom: this.getRoom,
    };
  }

  addEventReadReceipt(eventId: string, receipt: { readAt: Date }) {
    this.currentUserEventReadReceipts.set(eventId, receipt);
  }

  get ready() {
    return this.#ready;
  }

  get isLoading() {
    return this.loadSDK.isRunning;
  }

  private cardAPIModule = importResource(
    this,
    () => 'https://cardstack.com/base/card-api',
  );

  private loadSDK = task(async () => {
    await this.cardAPIModule.loaded;
    // The matrix SDK is VERY big so we only load it when we need it
    this.#matrixSDK = await import('matrix-js-sdk');
    this._client = this.matrixSDK.createClient({ baseUrl: matrixURL });
    // building the event bindings like this so that we can consistently bind
    // and unbind these events programmatically--this way if we add a new event
    // we won't forget to unbind it.
    this.#eventBindings = [
      [
        this.matrixSDK.RoomMemberEvent.Membership,
        Membership.onMembership(this),
      ],
      [this.matrixSDK.RoomEvent.Timeline, Timeline.onTimeline(this)],
      [
        this.matrixSDK.RoomEvent.LocalEchoUpdated,
        Timeline.onUpdateEventStatus(this),
      ],
      [this.matrixSDK.RoomEvent.Receipt, Timeline.onReceipt(this)],
    ];
  });

  get isLoggedIn() {
    return this.client.isLoggedIn();
  }

  get client() {
    if (!this._client) {
      throw new Error(`cannot use matrix client before matrix SDK has loaded`);
    }
    return this._client;
  }

  get userId() {
    return this.client.getUserId();
  }

  get cardAPI() {
    if (this.cardAPIModule.error) {
      throw new Error(
        `Error loading Card API: ${JSON.stringify(this.cardAPIModule.error)}`,
      );
    }
    if (!this.cardAPIModule.module) {
      throw new Error(
        `bug: Card API has not loaded yet--make sure to await this.loaded before using the api`,
      );
    }
    return this.cardAPIModule.module as typeof CardAPI;
  }

  get matrixSDK() {
    if (!this.#matrixSDK) {
      throw new Error(`cannot use matrix SDK before it has loaded`);
    }
    return this.#matrixSDK;
  }

  async logout() {
    try {
      await this.flushMembership;
      await this.flushTimeline;
      clearAuth();
      this.realm.logout();
      this.unbindEventListeners();
      await this.client.logout(true);
    } catch (e) {
      console.log('Error logging out of Matrix', e);
    } finally {
      this.resetState();
    }
  }

  async startAndSetDisplayName(auth: LoginResponse, displayName: string) {
    this.start(auth);
    this.setDisplayName(displayName);
    await this.router.refresh();
  }

  async setDisplayName(displayName: string) {
    await this.client.setDisplayName(displayName);
  }

  async reloadProfile() {
    await this.profile.load.perform();
  }

  async start(auth?: MatrixSDK.LoginResponse) {
    if (!auth) {
      auth = getAuth();
      if (!auth) {
        return;
      }
    }

    let {
      access_token: accessToken,
      user_id: userId,
      device_id: deviceId,
    } = auth;

    if (!accessToken) {
      throw new Error(
        `Cannot create matrix client from auth that has no access token: ${JSON.stringify(
          auth,
          null,
          2,
        )}`,
      );
    }
    if (!userId) {
      throw new Error(
        `Cannot create matrix client from auth that has no user id: ${JSON.stringify(
          auth,
          null,
          2,
        )}`,
      );
    }
    if (!deviceId) {
      throw new Error(
        `Cannot create matrix client from auth that has no device id: ${JSON.stringify(
          auth,
          null,
          2,
        )}`,
      );
    }
    this._client = this.matrixSDK.createClient({
      baseUrl: matrixURL,
      accessToken,
      userId,
      deviceId,
    });
    if (this.isLoggedIn) {
      saveAuth(auth);
      this.bindEventListeners();

      try {
        await this._client.startClient();
        await this.loginToRealms();
        await this.initializeRooms();
      } catch (e) {
        console.log('Error starting Matrix client', e);
        await this.logout();
      }
    }
  }

  private async loginToRealms() {
    // This is where we would actually load user-specific choices out of the
    // user's profile based on this.client.getUserId();
    let activeRealms = this.cardService.realmURLs;

    await Promise.all(
      activeRealms.map(async (realmURL) => {
        try {
          // Our authorization-middleware can login automatically after seeing a
          // 401, but this preemptive login makes it possible to see
          // canWrite===true on realms that are publicly readable.
          await this.realm.login(realmURL);
        } catch (err) {
          console.warn(
            `Unable to establish session with realm ${realmURL}`,
            err,
          );
        }
      }),
    );
  }

  public async createRealmSession(realmURL: URL) {
    await this.ready;

    let inflightAuth = this.realmSessionTasks.get(realmURL.href);

    if (inflightAuth) {
      return inflightAuth;
    }

    let realmAuthClient = new RealmAuthClient(
      realmURL,
      this.client,
      this.loaderService.loader.fetch,
    );

    let jwtPromise = realmAuthClient.getJWT();

    this.realmSessionTasks.set(realmURL.href, jwtPromise);

    jwtPromise
      .then(() => {
        this.realmSessionTasks.delete(realmURL.href);
      })
      .catch(() => {
        this.realmSessionTasks.delete(realmURL.href);
      });

    return jwtPromise;
  }

  async createRoom(
    name: string,
    invites: string[], // these can be local names
    topic?: string,
  ): Promise<string> {
    let userId = this.client.getUserId();
    if (!userId) {
      throw new Error(
        `bug: there is no userId associated with the matrix client`,
      );
    }
    let invite = invites.map((i) =>
      i.startsWith('@') ? i : `@${i}:${userId!.split(':')[1]}`,
    );
    let { room_id: roomId } = await this.client.createRoom({
      preset: this.matrixSDK.Preset.PrivateChat,
      invite,
      name,
      topic,
      room_alias_name: encodeURIComponent(
        `${name} - ${format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")} - ${
          this.userId
        }`,
      ),
    });
    invites.map((i) => {
      let fullId = i.startsWith('@') ? i : `@${i}:${userId!.split(':')[1]}`;
      if (i === aiBotUsername) {
        this.client.setPowerLevel(roomId, fullId, AI_BOT_POWER_LEVEL, null);
      }
    });
    return roomId;
  }

  // these can be local names
  async invite(roomId: string, invite: string[]) {
    let userId = this.client.getUserId();
    if (!userId) {
      throw new Error(
        `bug: there is no userId associated with the matrix client`,
      );
    }
    await Promise.all(
      invite.map((i) =>
        this.client.invite(
          roomId,
          i.startsWith('@') ? i : `@${i}:${userId!.split(':')[1]}`,
        ),
      ),
    );
  }

  private async sendEvent(
    roomId: string,
    eventType: string,
    content: CardMessageContent | CardFragmentContent | ReactionEventContent,
  ) {
    if ('data' in content) {
      const encodedContent = {
        ...content,
        data: JSON.stringify(content.data),
      };
      return await this.client.sendEvent(roomId, eventType, encodedContent);
    } else {
      return await this.client.sendEvent(roomId, eventType, content);
    }
  }

  async sendReactionEvent(roomId: string, eventId: string, status: string) {
    let content: ReactionEventContent = {
      'm.relates_to': {
        event_id: eventId,
        key: status,
        rel_type: 'm.annotation',
      },
    };
    try {
      return await this.sendEvent(roomId, 'm.reaction', content);
    } catch (e) {
      throw new Error(
        `Error sending reaction event: ${
          'message' in (e as Error) ? (e as Error).message : e
        }`,
      );
    }
  }

  async sendMessage(
    roomId: string,
    body: string | undefined,
    attachedCards: CardDef[] = [],
    clientGeneratedId: string,
    context?: OperatorModeContext,
  ): Promise<void> {
    let html = markdownToHtml(body);
    let tools = [];
    let serializedAttachedCards: LooseSingleCardDocument[] = [];
    let attachedOpenCards: CardDef[] = [];
    let submode = context?.submode;
    if (submode === 'interact') {
      let mappings = await basicMappings(this.loaderService.loader);
      // Open cards are attached automatically
      // If they are not attached, the user is not allowing us to
      // modify them
      attachedOpenCards = attachedCards.filter((c) =>
        (context?.openCardIds ?? []).includes(c.id),
      );
      // Generate tool calls for patching currently open cards permitted for modification
      for (let attachedOpenCard of attachedOpenCards) {
        let patchSpec = generateCardPatchCallSpecification(
          attachedOpenCard.constructor as typeof CardDef,
          this.cardAPI,
          mappings,
        );
        if (this.realm.canWrite(attachedOpenCard.id)) {
          tools.push({
            type: 'function',
            function: {
              name: 'patchCard',
              description: `Propose a patch to an existing card to change its contents. Any attributes specified will be fully replaced, return the minimum required to make the change. If a relationship field value is removed, set the self property of the specific item to null. When editing a relationship array, display the full array in the patch code. Ensure the description explains what change you are making.`,
              parameters: {
                type: 'object',
                properties: {
                  card_id: {
                    type: 'string',
                    const: attachedOpenCard.id, // Force the valid card_id to be the id of the card being patched
                  },
                  description: {
                    type: 'string',
                  },
                  ...patchSpec,
                },
                required: ['card_id', 'attributes', 'description'],
              },
            },
          });
        }
      }
    }

    if (attachedCards?.length) {
      serializedAttachedCards = await Promise.all(
        attachedCards.map(async (card) => {
          let { Base64ImageField } = await loaderFor(card).import<{
            Base64ImageField: typeof Base64ImageFieldType;
          }>(`${baseRealm.url}base64-image`);
          return await this.cardService.serializeCard(card, {
            omitFields: [Base64ImageField],
          });
        }),
      );
    }

    let attachedCardsEventIds: string[] = [];
    if (serializedAttachedCards.length > 0) {
      for (let attachedCard of serializedAttachedCards) {
        let eventId = this.cardHashes.get(
          this.generateCardHashKey(roomId, attachedCard),
        );
        if (eventId === undefined) {
          let responses = await this.sendCardFragments(roomId, attachedCard);
          eventId = responses[0].event_id; // we only care about the first fragment
          this.cardHashes.set(
            this.generateCardHashKey(roomId, attachedCard),
            eventId,
          );
        }

        attachedCardsEventIds.push(eventId);
      }
    }

    await this.sendEvent(roomId, 'm.room.message', {
      msgtype: 'org.boxel.message',
      body: body || '',
      format: 'org.matrix.custom.html',
      formatted_body: html,
      clientGeneratedId,
      data: {
        attachedCardsEventIds,
        context: {
          openCardIds: attachedOpenCards.map((c) => c.id),
          tools,
          submode,
        },
      },
    } as CardMessageContent);
  }

  generateCardHashKey(roomId: string, card: LooseSingleCardDocument) {
    return md5(roomId + JSON.stringify(card));
  }

  private async sendCardFragments(
    roomId: string,
    card: LooseSingleCardDocument,
  ): Promise<ISendEventResponse[]> {
    let fragments = splitStringIntoChunks(
      JSON.stringify(card),
      MAX_CARD_SIZE_KB,
    );
    let responses: ISendEventResponse[] = [];
    for (let index = fragments.length - 1; index >= 0; index--) {
      let cardFragment = fragments[index];
      let response = await this.sendEvent(roomId, 'm.room.message', {
        msgtype: 'org.boxel.cardFragment' as const,
        format: 'org.boxel.card' as const,
        body: `card fragment ${index + 1} of ${fragments.length}`,
        formatted_body: `card fragment ${index + 1} of ${fragments.length}`,
        data: {
          ...(index < fragments.length - 1
            ? { nextFragment: responses[0].event_id }
            : {}),
          cardFragment,
          index,
          totalParts: fragments.length,
        },
      } as CardFragmentContent);
      responses.unshift(response);
    }
    return responses;
  }

  async initializeRooms() {
    let { joined_rooms: joinedRooms } = await this.client.getJoinedRooms();
    for (let roomId of joinedRooms) {
      let stateEvents = await this.client.roomState(roomId);
      await Promise.all(
        stateEvents.map((event) => {
          addRoomEvent(this, { ...event, status: null });
        }),
      );
      let messages = await this.allRoomMessages(roomId);
      await Promise.all(
        messages.map((event) => {
          addRoomEvent(this, { ...event, status: null });
        }),
      );
    }
  }

  async allRoomMessages(roomId: string, opts?: MessageOptions) {
    let messages: DiscreteMatrixEvent[] = [];
    let from: string | undefined;

    do {
      let response = await fetch(
        `${matrixURL}/_matrix/client/v3/rooms/${roomId}/messages?dir=${
          opts?.direction ? opts.direction.slice(0, 1) : 'f'
        }&limit=${opts?.pageSize ?? DEFAULT_PAGE_SIZE}${
          from ? '&from=' + from : ''
        }`,
        {
          headers: {
            Authorization: `Bearer ${this.client.getAccessToken()}`,
          },
        },
      );
      let { chunk, end } = await response.json();
      from = end;
      let events: DiscreteMatrixEvent[] = chunk;
      if (opts?.onMessages) {
        await opts.onMessages(events);
      }
      messages.push(...events);
    } while (from);
    return messages;
  }

  private async requestEmailToken(
    type: 'registration' | 'threepid',
    email: string,
    clientSecret: string,
    sendAttempt: number,
  ) {
    let url =
      type === 'registration'
        ? `${matrixURL}/_matrix/client/v3/register/email/requestToken`
        : `${matrixURL}/_matrix/client/v3/account/3pid/email/requestToken`;

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        client_secret: clientSecret,
        send_attempt: sendAttempt,
      }),
    });
    if (response.ok) {
      return (await response.json()) as MatrixSDK.IRequestTokenResponse;
    } else {
      let data = (await response.json()) as { errcode: string; error: string };
      let error = new Error(data.error) as any;
      error.data = data;
      error.status = response.status;
      throw error;
    }
  }

  getLastActiveTimestamp(roomId: string, defaultTimestamp: number) {
    let matrixRoom = this.client.getRoom(roomId);
    let lastMatrixEvent = matrixRoom?.getLastActiveTimestamp();
    return lastMatrixEvent ?? defaultTimestamp;
  }

  async requestRegisterEmailToken(
    email: string,
    clientSecret: string,
    sendAttempt: number,
  ) {
    return await this.requestEmailToken(
      'registration',
      email,
      clientSecret,
      sendAttempt,
    );
  }

  async requestChangeEmailToken(
    email: string,
    clientSecret: string,
    sendAttempt: number,
  ) {
    return await this.requestEmailToken(
      'threepid',
      email,
      clientSecret,
      sendAttempt,
    );
  }

  async getPowerLevels(roomId: string): Promise<{ [userId: string]: number }> {
    let response = await fetch(
      `${matrixURL}/_matrix/client/v3/rooms/${roomId}/state/m.room.power_levels/`,
      {
        headers: {
          Authorization: `Bearer ${this.client.getAccessToken()}`,
        },
      },
    );
    let { users } = await response.json();
    return users;
  }

  // the matrix SDK is using an old version of this API and
  // doesn't provide login using email, so we use the API directly
  async loginWithEmail(email: string, password: string) {
    let response = await fetch(`${matrixURL}/_matrix/client/v3/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: {
          type: 'm.id.thirdparty',
          medium: 'email',
          address: email,
        },
        password,
        type: 'm.login.password',
      }),
    });
    if (response.ok) {
      return (await response.json()) as MatrixSDK.LoginResponse;
    } else {
      let data = (await response.json()) as { errcode: string; error: string };
      let error = new Error(data.error) as any;
      error.data = data;
      error.status = response.status;
      throw error;
    }
  }

  async login(usernameOrEmail: string, password: string) {
    try {
      const cred = await this.client.loginWithPassword(
        usernameOrEmail,
        password,
      );
      return cred;
    } catch (error) {
      try {
        const cred = await this.loginWithEmail(usernameOrEmail, password);
        return cred;
      } catch (error2) {
        throw error;
      }
    }
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  setRoom(roomId: string, room: RoomState) {
    this.rooms.set(roomId, room);
    if (!this.roomResourcesCache.has(roomId)) {
      this.roomResourcesCache.set(
        roomId,
        getRoom(
          this,
          () => roomId,
          () => this.getRoom(roomId)?.events,
        ),
      );
    }
  }

  @cached
  get roomResources() {
    let resources: TrackedMap<string, RoomResource> = new TrackedMap();
    for (let roomId of this.rooms.keys()) {
      if (!this.roomResourcesCache.get(roomId)) {
        continue;
      }
      resources.set(roomId, this.roomResourcesCache.get(roomId)!);
    }
    return resources;
  }

  private resetState() {
    this.rooms = new TrackedMap();
    this.roomMembershipQueue = [];
    this.roomResourcesCache.clear();
    this.timelineQueue = [];
    this.flushMembership = undefined;
    this.flushTimeline = undefined;
    this.unbindEventListeners();
    this._client = this.matrixSDK.createClient({ baseUrl: matrixURL });
    this.cardHashes = new Map();
  }

  private bindEventListeners() {
    if (!this.#eventBindings) {
      throw new Error(
        `cannot bind to matrix events before the matrix SDK has loaded`,
      );
    }
    for (let [event, handler] of this.#eventBindings) {
      this.client.on(event, handler);
    }
  }
  private unbindEventListeners() {
    if (!this.#eventBindings) {
      throw new Error(
        `cannot unbind to matrix events before the matrix SDK has loaded`,
      );
    }
    for (let [event, handler] of this.#eventBindings) {
      this.client.off(event, handler);
    }
  }

  async createCommandField(attr: Record<string, any>): Promise<PatchField> {
    let data: LooseCardResource = {
      meta: {
        adoptsFrom: {
          name: 'PatchField',
          module: `${baseRealm.url}command`,
        },
      },
      attributes: {
        ...attr,
      },
    };
    let card = this.cardAPI.createFromSerialized<typeof PatchField>(
      data,
      { data },
      undefined,
    );
    return card;
  }
}

function saveAuth(auth: LoginResponse) {
  localStorage.setItem('auth', JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem('auth');
  localStorage.removeItem(currentRoomIdPersistenceKey);
}

function getAuth(): LoginResponse | undefined {
  let auth = localStorage.getItem('auth');
  if (!auth) {
    return;
  }
  return JSON.parse(auth) as LoginResponse;
}

interface MessageOptions {
  direction?: 'forward' | 'backward';
  onMessages?: (messages: DiscreteMatrixEvent[]) => Promise<void>;
  pageSize: number;
}
