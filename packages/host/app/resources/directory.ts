import { Resource } from 'ember-resources/core';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import type { Relationship } from '@cardstack/runtime-common';
import { RealmPaths } from '@cardstack/runtime-common/paths';
import { registerDestructor } from '@ember/destroyable';
import type LoaderService from '../services/loader-service';
import type MessageService from '../services/message-service';

interface Args {
  named: {
    url: string | undefined;
    openDirs: string | undefined;
  };
}

export interface Entry {
  name: string;
  kind: 'directory' | 'file';
  path: string;
}

export class DirectoryResource extends Resource<Args> {
  @tracked entries: Entry[] = [];
  private url: string | undefined;
  private declare realmPath: RealmPaths;

  @service declare loaderService: LoaderService;
  @service declare messageService: MessageService;

  modify(_positional: never[], named: Args['named']) {
    if (named.url) {
      if (!named.url.endsWith('/')) {
        throw new Error(`A directory URL must end with a "/"`);
      }
      this.realmPath = new RealmPaths(named.url);
      this.url = named.url;
      taskFor(this.readdir).perform();
    }
    this.messageService.subscribe(this.realmPath.url, (_ev) => {
      console.log('Event: update, data: ' + _ev.data);
      taskFor(this.readdir).perform();
    });
    registerDestructor(this, () =>
      this.messageService.unsubscribe(this.realmPath.url)
    );
  }

  @restartableTask private async readdir() {
    if (!this.url) {
      return;
    }
    let entries = await this.getEntries(this.realmPath, this.url);
    entries.sort((a, b) => {
      // need to re-insert the leading and trailing /'s in order to get a sort
      // that can organize the paths correctly
      let pathA = `/${a.path}${a.kind === 'directory' ? '/' : ''}`;
      let pathB = `/${b.path}${b.kind === 'directory' ? '/' : ''}`;
      return pathA.localeCompare(pathB);
    });
    this.entries = entries;
  }

  private async getEntries(
    realmPath: RealmPaths,
    url: string
  ): Promise<Entry[]> {
    let response: Response | undefined;
    response = await this.loaderService.loader.fetch(url, {
      headers: { Accept: 'application/vnd.api+json' },
    });
    if (!response.ok) {
      // the server takes a moment to become ready do be tolerant of errors at boot
      console.log(
        `Could not get directory listing ${url}, status ${response.status}: ${
          response.statusText
        } - ${await response.text()}`
      );
      return [];
    }

    let {
      data: { relationships: _relationships },
    } = await response.json();
    let relationships = _relationships as Record<string, Relationship>;
    return Object.entries(relationships).map(([name, info]) => ({
      name,
      kind: info.meta!.kind,
      path: realmPath.local(new URL(info.links!.related!)),
    }));
  }
}

export function directory(
  parent: object,
  url: () => string | undefined,
  openDirs: () => string | undefined
) {
  return DirectoryResource.from(parent, () => ({
    named: { url: url(), openDirs: openDirs() },
  })) as DirectoryResource;
}
