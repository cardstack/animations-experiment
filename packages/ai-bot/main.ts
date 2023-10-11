import './setup-logger'; // This should be first
import {
  IContent,
  RoomMemberEvent,
  RoomEvent,
  createClient,
  ISendEventResponse,
  Room,
  MatrixClient,
  IRoomEvent,
} from 'matrix-js-sdk';
import OpenAI from 'openai';
import { ChatCompletionChunk } from 'openai/resources/chat';
import { logger, aiBotUsername } from '@cardstack/runtime-common';
import {
  constructHistory,
  extractContentFromStream,
  processStream,
  ParsingMode,
  getModifyPrompt,
  cleanContent,
} from './helpers';

let log = logger('ai-bot');

/***
 * TODO:
 * When constructing the historical cards, also get the card ones so we have that context
 * Which model to use & system prompts
 * interactions?
 */

const openai = new OpenAI();

let startTime = Date.now();

async function sendMessage(
  client: MatrixClient,
  room: Room,
  content: string,
  previous: string | undefined,
) {
  log.info('Sending', content);
  let messageObject: IContent = {
    body: content,
    msgtype: 'm.text',
    formatted_body: content,
    format: 'org.matrix.custom.html',
    'm.new_content': {
      body: content,
      msgtype: 'm.text',
      formatted_body: content,
      format: 'org.matrix.custom.html',
    },
  };
  if (previous) {
    messageObject['m.relates_to'] = {
      rel_type: 'm.replace',
      event_id: previous,
    };
  }
  return await client.sendEvent(room.roomId, 'm.room.message', messageObject);
}

async function sendOption(client: MatrixClient, room: Room, content: any) {
  log.info('sending option', content);
  let patch = content['patch'];
  if (patch['attributes']) {
    patch = patch['attributes'];
  }
  let id = content['id'];

  let messageObject = {
    body: 'patch',
    msgtype: 'org.boxel.command',
    formatted_body: 'A patch',
    format: 'org.matrix.custom.html',
    command: {
      type: 'patch',
      id: id,
      patch: {
        attributes: patch,
      },
    },
  };
  log.info(JSON.stringify(messageObject, null, 2));
  log.info('Sending', messageObject);
  return await client.sendEvent(room.roomId, 'm.room.message', messageObject);
}

async function sendStream(
  stream: AsyncIterable<ChatCompletionChunk>,
  client: MatrixClient,
  room: Room,
  append_to?: string,
) {
  let unsent = 0;
  let lastUnsentMessage = undefined;
  for await (const message of processStream(extractContentFromStream(stream))) {
    // If we've not got a current message to edit and we're processing text
    // rather than structured data, start a new message to update.
    if (message.type == ParsingMode.Text) {
      // remove general cruft
      let cleanedContent = cleanContent(message.content!);
      // If we're left with nothing after cleaning, don't send anything
      if (cleanedContent) {
        // If there's no message to append to, just send the message
        // If there's more than 20 pending messages, send the message
        if (!append_to) {
          let initialMessage = await sendMessage(
            client,
            room,
            cleanedContent,
            append_to,
          );
          unsent = 0;
          lastUnsentMessage = undefined;
          append_to = initialMessage.event_id;
        }

        if (unsent > 20) {
          await sendMessage(client, room, cleanedContent, append_to);
          unsent = 0;
        } else {
          lastUnsentMessage = message;
          unsent += 1;
        }
      }
    } else {
      if (lastUnsentMessage && lastUnsentMessage.content) {
        let cleanedContent = cleanContent(lastUnsentMessage.content);
        if (cleanedContent) {
          await sendMessage(client, room, cleanedContent, append_to);
        }
        lastUnsentMessage = undefined;
      }
      if (message.type == ParsingMode.Command) {
        await sendOption(client, room, message.content);
      }
      unsent = 0;
      append_to = undefined;
    }
  }

  // Make sure we send any remaining content at the end of the stream
  if (lastUnsentMessage && lastUnsentMessage.content) {
    let cleanedContent = cleanContent(lastUnsentMessage.content);
    if (cleanedContent) {
      await sendMessage(client, room, cleanedContent, append_to);
    }
  }
}

function getLastUploadedCardID(history: IRoomEvent[]): String | undefined {
  for (let event of history.slice().reverse()) {
    const content = event.content;
    if (content.msgtype === 'org.boxel.card') {
      let card = content.instance.data;
      return card.id;
    }
  }
  return undefined;
}

async function getResponse(history: IRoomEvent[], aiBotUsername: string) {
  let messages = getModifyPrompt(history, aiBotUsername);
  return await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages,
    stream: true,
  });
}

(async () => {
  let client = createClient({
    baseUrl: process.env.MATRIX_URL || 'http://localhost:8008',
  });
  let auth = await client.loginWithPassword(
    aiBotUsername,
    process.env.BOXEL_AIBOT_PASSWORD || 'pass',
  );
  let { user_id } = auth;
  client.on(RoomMemberEvent.Membership, function (_event, member) {
    if (member.membership === 'invite' && member.userId === user_id) {
      client
        .joinRoom(member.roomId)
        .then(function () {
          log.info('Auto-joined %s', member.roomId);
        })
        .catch(function (err) {
          log.info(
            'Error joining this room, typically happens when a user invites then leaves before this is joined',
            err,
          );
        });
    }
  });

  // TODO: Set this up to use a queue that gets drained
  client.on(
    RoomEvent.Timeline,
    async function (event, room, toStartOfTimeline) {
      if (!room) {
        return;
      }
      log.info(
        '(%s) %s :: %s',
        room?.name,
        event.getSender(),
        event.getContent().body,
      );

      if (event.event.origin_server_ts! < startTime) {
        return;
      }
      if (toStartOfTimeline) {
        return; // don't print paginated results
      }
      if (event.getType() !== 'm.room.message') {
        return; // only print messages
      }
      if (event.getSender() === user_id) {
        return;
      }
      let initialMessage: ISendEventResponse = await client.sendHtmlMessage(
        room!.roomId,
        'Thinking...',
        'Thinking...',
      );

      let initial = await client.roomInitialSync(room!.roomId, 1000);
      let eventList = initial!.messages?.chunk || [];
      log.info(eventList);

      log.info('Total event list', eventList.length);
      let history: IRoomEvent[] = constructHistory(eventList);
      log.info("Compressed into just the history that's ", history.length);

      // While developing the frontend it can be handy to skip GPT and just return some data
      if (event.getContent().body.startsWith('debugpatch:')) {
        let body = event.getContent().body;
        let patchMessage = body.split('debugpatch:')[1];
        // If there's a card attached, we need to split it off to parse the json
        patchMessage = patchMessage.split('(Card')[0];
        let attributes = {};
        try {
          attributes = JSON.parse(patchMessage);
        } catch (error) {
          await sendMessage(
            client,
            room,
            'Error parsing your debug patch as JSON: ' + patchMessage,
            initialMessage.event_id,
          );
        }
        let messageObject = {
          body: 'some response, a patch',
          msgtype: 'org.boxel.command',
          formatted_body: 'some response, a patch',
          format: 'org.matrix.custom.html',
          command: {
            type: 'patch',
            id: getLastUploadedCardID(history),
            patch: {
              attributes: attributes,
            },
          },
        };
        return await client.sendEvent(
          room.roomId,
          'm.room.message',
          messageObject,
        );
      }

      const stream = await getResponse(history, user_id);
      return await sendStream(stream, client, room, initialMessage.event_id);
    },
  );

  await client.startClient();
  log.info('client started');
})().catch((e) => {
  log.error(e);
  process.exit(1);
});
