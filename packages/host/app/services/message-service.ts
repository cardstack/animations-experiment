import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import type LoaderService from './loader-service';

export default class MessageService extends Service {
  @tracked subscriptions: Map<string, EventSource> = new Map();
  @service declare loaderService: LoaderService;

  subscribe(realmURL: string, cb: (ev: MessageEvent) => void): () => void {
    let resolvedRealmURL = this.loaderService.loader.resolve(realmURL);
    let maybeEventSource = this.subscriptions.get(resolvedRealmURL.href);

    if (!maybeEventSource) {
      maybeEventSource = new EventSource(resolvedRealmURL);
      maybeEventSource.onerror = () => eventSource.close();
      this.subscriptions.set(resolvedRealmURL.href, maybeEventSource);
    }

    let eventSource = maybeEventSource;
    eventSource.addEventListener('update', cb);
    return () => {
      eventSource.removeEventListener('update', cb);
    };
  }
}
