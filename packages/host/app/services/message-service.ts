import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class MessageService extends Service {
  @tracked subscriptionsMap: Map<
    string, // URL path
    EventSource
  > = new Map();

  subscribe(realmURL: string, cb: (ev: MessageEvent) => void): () => void {
    let maybeEventSource = this.subscriptionsMap.get(realmURL);

    if (!maybeEventSource) {
      maybeEventSource = new EventSource(realmURL);
      this.start(maybeEventSource);
      this.subscriptionsMap.set(realmURL, maybeEventSource);
    }

    let eventSource = maybeEventSource;
    eventSource.addEventListener('update', cb);
    console.log(`Created new event source for ${realmURL}`);
    return () => {
      eventSource.removeEventListener('update', cb);
      console.log(`Unsubscribed realm: ${realmURL}`);
    };
  }

  start(eventSource: EventSource) {
    eventSource.onerror = (_ev: Event) => {
      if (eventSource.readyState == EventSource.CONNECTING) {
        console.log(`Reconnecting to ${eventSource.url}...`);
      } else if (eventSource.readyState == EventSource.CLOSED) {
        console.log(`Connection closed for ${eventSource.url}`);
        eventSource.close();
      } else {
        console.log(`An error has occured for ${eventSource.url}`);
      }
    };

    eventSource.onmessage = (e: MessageEvent) => {
      console.log('Event: message, data: ' + e.data);
    };
  }

  // closeEventSource(eventSource: EventSource) {
  //   eventSource.close();
  //   let info = this.subscriptionsMap.get(eventSource.url);
  //   if (!info) {
  //     return;
  //   }
  //   info = info.filter(
  //     (item) => item.eventSource.readyState === EventSource.OPEN
  //   );
  //   if (info.length === 0) {
  //     this.subscriptionsMap.delete(eventSource.url);
  //     console.log(`removing ${eventSource.url}`);
  //   } else {
  //     console.log(`new count for ${eventSource.url}: ${info.length}`);
  //     this.subscriptionsMap.set(eventSource.url, info);
  //   }
  // }
}
