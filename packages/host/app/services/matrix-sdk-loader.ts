import Service from '@ember/service';

import type { MatrixEvent as DiscreteMatrixEvent } from 'https://cardstack.com/base/matrix-event';

import type * as MatrixSDK from 'matrix-js-sdk';

const DEFAULT_PAGE_SIZE = 50;

/*
  This abstracts over the matrix SDK, including several extra functions that are
  actually implemented via direct HTTP.
*/
export default class MatrixSDKLoader extends Service {
  #extended: ExtendedMatrixSDK | undefined;

  async load(): Promise<ExtendedMatrixSDK> {
    if (!this.#extended) {
      let sdk = await import('matrix-js-sdk');
      this.#extended = new ExtendedMatrixSDK(sdk);
    }
    return this.#extended;
  }
}

export class ExtendedMatrixSDK {
  #sdk: typeof MatrixSDK;

  constructor(sdk: typeof MatrixSDK) {
    this.#sdk = sdk;
  }

  get RoomMemberEvent() {
    return this.#sdk.RoomMemberEvent;
  }

  get RoomEvent() {
    return this.#sdk.RoomEvent;
  }

  get Preset() {
    return this.#sdk.Preset;
  }

  createClient(opts: MatrixSDK.ICreateClientOpts): ExtendedClient {
    return extendedClient(this.#sdk.createClient(opts), opts.baseUrl);
  }
}

export type ExtendedClient = MatrixSDK.MatrixClient & {
  allRoomMessages(
    roomId: string,
    opts?: MessageOptions,
  ): Promise<DiscreteMatrixEvent[]>;
};

async function allRoomMessages(
  this: MatrixSDK.MatrixClient,
  matrixURL: string,
  roomId: string,
  opts?: MessageOptions,
): Promise<DiscreteMatrixEvent[]> {
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
          Authorization: `Bearer ${this.getAccessToken()}`,
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

function extendedClient(
  client: MatrixSDK.MatrixClient,
  baseURL: string,
): ExtendedClient {
  return new Proxy(client, {
    get(target, key, receiver) {
      switch (key) {
        case 'allRoomMessages':
          return allRoomMessages.bind(client, baseURL);
        default:
          return Reflect.get(target, key, receiver);
      }
    },
  }) as unknown as ExtendedClient;
}

interface MessageOptions {
  direction?: 'forward' | 'backward';
  onMessages?: (messages: DiscreteMatrixEvent[]) => Promise<void>;
  pageSize: number;
}
