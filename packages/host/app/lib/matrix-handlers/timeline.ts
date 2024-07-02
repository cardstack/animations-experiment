import debounce from 'lodash/debounce';
import { Room, type MatrixEvent } from 'matrix-js-sdk';

import {
  type CardMessageContent,
  type CardFragmentContent,
  type MatrixEvent as DiscreteMatrixEvent,
} from 'https://cardstack.com/base/matrix-event';

import { eventDebounceMs } from '../matrix-utils';

import {
  type Context,
  type Event,
  addRoomEvent,
  updateRoomEvent,
} from './index';

export function onReceipt(context: Context) {
  return async (e: MatrixEvent) => {
    let userId = context.client?.credentials.userId;
    if (userId) {
      let eventIds = Object.keys(e.getContent());
      for (let eventId of eventIds) {
        let receipt = e.getContent()[eventId]['m.read'][userId];
        if (receipt) {
          context.addEventReadReceipt(eventId, { readAt: receipt.ts });
        }
      }
    }
  };
}

export function onTimeline(context: Context) {
  return (e: MatrixEvent) => {
    context.timelineQueue.push({ event: e });
    debouncedTimelineDrain(context);
  };
}

export function onUpdateEventStatus(context: Context) {
  return (e: MatrixEvent, _room: Room, maybeOldEventId?: unknown) => {
    if (typeof maybeOldEventId !== 'string') {
      return;
    }
    context.timelineQueue.push({ event: e, oldEventId: maybeOldEventId });
    debouncedTimelineDrain(context);
  };
}

const debouncedTimelineDrain = debounce((context: Context) => {
  drainTimeline(context);
}, eventDebounceMs);

async function drainTimeline(context: Context) {
  await context.flushTimeline;

  let eventsDrained: () => void;
  context.flushTimeline = new Promise((res) => (eventsDrained = res));
  let events = [...context.timelineQueue];
  context.timelineQueue = [];
  for (let { event, oldEventId } of events) {
    await context.client?.decryptEventIfNeeded(event);
    await processDecryptedEvent(
      context,
      {
        ...event.event,
        status: event.status,
        content: event.getContent() || undefined,
        error: event.error ?? undefined,
      },
      oldEventId,
    );
  }
  eventsDrained!();
}

async function processDecryptedEvent(
  context: Context,
  event: Event,
  oldEventId?: string,
) {
  let { room_id: roomId } = event;
  if (!roomId) {
    throw new Error(
      `bug: roomId is undefined for event ${JSON.stringify(event, null, 2)}`,
    );
  }
  let room = context.client?.getRoom(roomId);
  if (!room) {
    throw new Error(
      `bug: should never get here--matrix sdk returned a null room for ${roomId}`,
    );
  }

  let userId = context.client?.getUserId();
  if (!userId) {
    throw new Error(
      `bug: userId is required for event ${JSON.stringify(event, null, 2)}`,
    );
  }

  // We might still receive events from the rooms that the user has left.
  let member = room.getMember(userId);
  if (!member || member.membership !== 'join') {
    return;
  }

  let roomField = await context.getRoom(roomId);
  // patch in any missing room events--this will support dealing with local
  // echoes, migrating older histories as well as handle any matrix syncing gaps
  // that might occur
  if (
    roomField &&
    event.type === 'm.room.message' &&
    event.content?.msgtype === 'org.boxel.message' &&
    event.content.data
  ) {
    let data = (
      typeof event.content.data === 'string'
        ? JSON.parse(event.content.data)
        : event.content.data
    ) as CardMessageContent['data'];
    if (
      'attachedCardsEventIds' in data &&
      Array.isArray(data.attachedCardsEventIds)
    ) {
      for (let attachedCardEventId of data.attachedCardsEventIds) {
        let currentFragmentId: string | undefined = attachedCardEventId;
        do {
          let fragmentEvent = roomField.events.find(
            (e: DiscreteMatrixEvent) => e.event_id === currentFragmentId,
          );
          let fragmentData: CardFragmentContent['data'];
          if (!fragmentEvent) {
            fragmentEvent = (await context.client?.fetchRoomEvent(
              roomId,
              currentFragmentId ?? '',
            )) as DiscreteMatrixEvent;
            if (
              fragmentEvent.type !== 'm.room.message' ||
              fragmentEvent.content.msgtype !== 'org.boxel.cardFragment'
            ) {
              throw new Error(
                `Expected event ${currentFragmentId} to be 'org.boxel.card' but was ${JSON.stringify(
                  fragmentEvent,
                )}`,
              );
            }
            await addRoomEvent(context, { ...fragmentEvent, status: null });
            fragmentData = (
              typeof fragmentEvent.content.data === 'string'
                ? JSON.parse((fragmentEvent.content as any).data)
                : fragmentEvent.content.data
            ) as CardFragmentContent['data'];
          } else {
            if (
              fragmentEvent.type !== 'm.room.message' ||
              fragmentEvent.content.msgtype !== 'org.boxel.cardFragment'
            ) {
              throw new Error(
                `Expected event to be 'org.boxel.cardFragment' but was ${JSON.stringify(
                  fragmentEvent,
                )}`,
              );
            }
            fragmentData = fragmentEvent.content.data;
          }
          currentFragmentId = fragmentData?.nextFragment; // using '?' so we can be kind to older event schemas
        } while (currentFragmentId);
      }
    }
  }
  if (oldEventId) {
    await updateRoomEvent(context, event, oldEventId);
  } else {
    await addRoomEvent(context, event);
  }

  if (room.oldState.paginationToken != null) {
    // we need to scroll back to capture any room events fired before this one
    await context.client?.scrollback(room);
  }
}
