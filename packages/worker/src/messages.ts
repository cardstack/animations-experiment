// this file should be portable to both DOM and ServiceWorker contexts. It
// establishes the common API between them.
import {
  type SearchEntryWithErrors,
  type SerializableRunState,
} from '@cardstack/runtime-common/search-index';

export interface RequestDirectoryHandle {
  type: 'requestDirectoryHandle';
  realmsServed: string[];
}
export interface SetDirectoryHandleAcknowledged {
  type: 'setDirectoryHandleAcknowledged';
}

export interface DirectoryHandleResponse {
  type: 'directoryHandleResponse';
  handle: FileSystemDirectoryHandle | null;
}

export interface SetDirectoryHandle {
  type: 'setDirectoryHandle';
  handle: FileSystemDirectoryHandle | null;
  realmsServed: string[];
}

export interface SetEntry {
  type: 'setEntry';
  url: string;
  entry: SearchEntryWithErrors;
}

export interface SetEntryAcknowledged {
  type: 'setEntryAcknowledged';
}

export interface StartFromScratchIndex {
  type: 'startFromScratch';
  realmURL: string;
}

export interface FromScratchCompleted {
  type: 'fromScratchCompleted';
  state: SerializableRunState;
}

export interface StartIncrementalIndex {
  type: 'startIncremental';
  prev: SerializableRunState;
  url: string;
  operation: 'delete' | 'update';
}

export interface IncrementalCompleted {
  type: 'incrementalCompleted';
  state: SerializableRunState;
}

export type ClientMessage =
  | RequestDirectoryHandle
  | SetDirectoryHandle
  | SetEntry
  | FromScratchCompleted
  | IncrementalCompleted;
export type WorkerMessage =
  | DirectoryHandleResponse
  | SetDirectoryHandleAcknowledged
  | SetEntryAcknowledged
  | StartFromScratchIndex
  | StartIncrementalIndex;
export type Message = ClientMessage | WorkerMessage;

function isMessageLike(
  maybeMessage: unknown
): maybeMessage is { type: string } {
  return (
    typeof maybeMessage === 'object' &&
    maybeMessage !== null &&
    'type' in maybeMessage &&
    typeof (maybeMessage as any).type === 'string'
  );
}

export function isClientMessage(message: unknown): message is ClientMessage {
  if (!isMessageLike(message)) {
    return false;
  }
  switch (message.type) {
    case 'getRunStateRequest':
    case 'requestDirectoryHandle':
      return 'realmsServed' in message && Array.isArray(message.realmsServed);
    case 'setDirectoryHandle':
      return (
        'handle' in message &&
        ((message as any).handle === null ||
          (message as any).handle instanceof FileSystemDirectoryHandle) &&
        'realmsServed' in message &&
        Array.isArray(message.realmsServed)
      );
    case 'setEntry':
      return (
        'url' in message &&
        typeof message.url === 'string' &&
        'entry' in message &&
        typeof message.entry === 'object' &&
        message.entry != null
      );
    case 'incrementalCompleted':
    case 'fromScratchCompleted':
      return (
        'state' in message &&
        typeof message.state === 'object' &&
        message.state != null
      );
    default:
      return false;
  }
}

export function isWorkerMessage(message: unknown): message is WorkerMessage {
  if (!isMessageLike(message)) {
    return false;
  }
  switch (message.type) {
    case 'setEntryAcknowledged':
    case 'setRunStateAcknowledged':
      return true;
    case 'directoryHandleResponse':
      return (
        'handle' in message &&
        ((message as any).handle === null ||
          (message as any).handle instanceof FileSystemDirectoryHandle)
      );
    case 'setDirectoryHandleAcknowledged':
      return true;
    case 'startFromScratch':
      return 'realmURL' in message && typeof message.realmURL === 'string';
    case 'startIncremental':
      return (
        'prev' in message &&
        typeof message.prev === 'object' &&
        message.prev != null &&
        'url' in message &&
        typeof message.url === 'string' &&
        'operation' in message &&
        typeof message.operation === 'string' &&
        ['update', 'delete'].includes(message.operation)
      );
    default:
      return false;
  }
}

interface Destination {
  postMessage(message: any, transfer: Transferable[]): void;
  postMessage(message: any, options?: StructuredSerializeOptions): void;
}

export function send(destination: Destination, message: Message): void {
  if (!destination) {
    throw new Error('client or worker message sent with no destination');
  }
  destination.postMessage(message);
}
