import { Resource } from 'ember-resources/core';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import type { Relationship } from '@cardstack/runtime-common';
import { registerDestructor } from '@ember/destroyable';
import type LoaderService from '../services/loader-service';
import type MessageService from '../services/message-service';
import type CardService from '../services/card-service';

interface Args {
  named: {
    relativePath: string;
    realmURL: string;
  };
}

export interface Entry {
  name: string;
  kind: 'directory' | 'file';
  path: string;
}

export class DirectoryResource extends Resource<Args> {
  @tracked entries: Entry[] = [];
  private directoryURL: string | undefined;
  private subscription: { url: string; unsubscribe: () => void } | undefined;

  @service declare loaderService: LoaderService;
  @service declare messageService: MessageService;
  @service declare cardService: CardService;

  constructor(owner: unknown) {
    super(owner);
    registerDestructor(this, () => {
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = undefined;
      }
    });
  }

  modify(_positional: never[], named: Args['named']) {
    this.directoryURL = new URL(named.relativePath, named.realmURL).href;
    taskFor(this.readdir).perform();

    let path = `${named.realmURL}_message`;

    if (this.subscription && this.subscription.url !== path) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    if (!this.subscription) {
      this.subscription = {
        url: path,
        unsubscribe: this.messageService.subscribe(path, () =>
          taskFor(this.readdir).perform()
        ),
      };
    }
  }

  @restartableTask private async readdir() {
    if (!this.directoryURL) {
      return;
    }
    let entries = await this.getEntries(this.directoryURL);
    entries.sort((a, b) => {
      // need to re-insert the leading and trailing /'s in order to get a sort
      // that can organize the paths correctly
      let pathA = `/${a.path}${a.kind === 'directory' ? '/' : ''}`;
      let pathB = `/${b.path}${b.kind === 'directory' ? '/' : ''}`;
      return pathA.localeCompare(pathB);
    });
    this.entries = entries;
  }

  private async getEntries(url: string): Promise<Entry[]> {
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
      path: info.links!.related!,
    }));
  }
}

export function directory(
  parent: object,
  relativePath: () => string | undefined,
  realmURL: () => string
) {
  return DirectoryResource.from(parent, () => ({
    relativePath: relativePath(),
    realmURL: realmURL(),
  })) as DirectoryResource;
}
