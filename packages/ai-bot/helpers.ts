import { IRoomEvent } from 'matrix-js-sdk';

type ChatCompletion = {
  choices: Array<{
    delta?: {
      content?: string | null | undefined;
    };
  }>;
};

export enum ParsingMode {
  Text,
  Command,
}

export type Message = {
  type: ParsingMode;
  content: string;
};

export function constructHistory(history: IRoomEvent[]) {
  /**
   * We send a lot of events to create messages,
   * as we stream updates to the UI. This works by
   * sending a new event with the full content and
   * information about which event it should replace
   *
   * This function is to construct the chat as a user
   * would see it - with only the latest event for each
   * message.
   */
  const latestEventsMap = new Map<string, IRoomEvent>();
  for (let event of history) {
    let content = event.content;
    if (event.type == 'm.room.message') {
      let eventId = event.event_id!;
      if (content['m.relates_to']?.rel_type === 'm.replace') {
        eventId = content['m.relates_to']!.event_id!;
        event.event_id = eventId;
      }
      const existingEvent = latestEventsMap.get(eventId);
      if (
        !existingEvent ||
        existingEvent.origin_server_ts < event.origin_server_ts
      ) {
        latestEventsMap.set(eventId, event);
      }
    }
  }
  let latestEvents = Array.from(latestEventsMap.values());
  latestEvents.sort((a, b) => a.origin_server_ts - b.origin_server_ts);
  return latestEvents;
}

export async function* extractContentFromStream(
  iterable: AsyncIterable<ChatCompletion>,
) {
  /**
   * The OpenAI API returns a stream of updates, which
   * have extra details that we don't need, this function
   * extracts out just the content from the stream.
   */
  for await (const part of iterable) {
    if (part.choices[0]?.delta?.content) {
      yield part.choices[0].delta.content;
    }
  }
}

export async function* processStream(stream: AsyncIterable<string>) {
  /**
   * The stream of tokens from GPT is a mix of text and structured data.
   * The text data should be yielded token by token so that the users
   * can see the text as it is generated.
   *
   * However we need to also detect structured content and extract that
   * out so that we can batch it up and send it to the server as one
   * message.
   *
   * TODO: This is fragile, and will be replace with a proper parser
   * as we remove the <option> format of messages.
   */
  let content = '';
  let currentParsingMode: ParsingMode = ParsingMode.Text;
  for await (const token of stream) {
    // The parsing here has to deal with a streaming response that
    // alternates between sections of text (to stream back to the client)
    // and structured data (to batch and send in one block)
    if (currentParsingMode === ParsingMode.Command) {
      // If we're currently parsing a command, and we hit what looks like the end of the command
      // then we need to start cleaning up the command and yield it.
      if (token.includes('</')) {
        // Content is the text we have built up so far
        if (content.startsWith('option>')) {
          content = content.replace('option>', '');
        }
        if (content.startsWith('>')) {
          content = content.replace('>', '');
        }
        if (content.endsWith('>')) {
          content = content.replace('>', '');
        }
        content += token.split('</')[0];
        // We have the whole patch, so we can yield it
        yield {
          type: ParsingMode.Command,
          content: content,
        };
        content = '';
        currentParsingMode = ParsingMode.Text;
      } else {
        // We are in command mode, and haven't detected the end of the the command
        // so we will just keep building up the command
        content += token;
      }
    } else if (currentParsingMode === ParsingMode.Text) {
      // Be explicit about the state we're in for readability
      if (token.includes('<')) {
        // Send the last update
        let beforeTag = token.split('<')[0];
        if (beforeTag) {
          yield {
            type: ParsingMode.Text,
            content: (content + beforeTag).trim(),
          };
        }
        // Move into command mode.
        // TODO: make this more robust against seeing < in the middle of a token
        // when it later turns out not to be in a command
        currentParsingMode = ParsingMode.Command;
        content = '';
      } else {
        content += token;
        if (token.trim()) {
          // These are at the beginning, they don't need to happen on every token
          content = content.replace(/^option/, '');
          content = content.replace(/^>/, '');
          content = content.replace(/^`.*/, '');
          content = content.replace(/`.*$/, '');
          if (content.trim()) {
            yield {
              type: ParsingMode.Text,
              content: content.trim(),
            };
          }
        }
      }
    }
  }
}
