import Component from '@glimmer/component';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { service } from '@ember/service';
//@ts-ignore cached not available yet in definitely typed
import { cached } from '@glimmer/tracking';
import { tracked } from '@glimmer/tracking';
import { isCardDocument } from '@cardstack/runtime-common';
import type LoaderService from '../services/loader-service';
import type CardService from '../services/card-service';
import type { FileResource } from '../resources/file';
import CardEditor from './card-editor';
import Module from './module';
import FileTree from './file-tree';
import {
  getLangFromFileExtension,
  extendMonacoLanguage,
  languageConfigs
} from '../utils/editor-language';
import monaco from '../modifiers/monaco';
import type { Card } from 'https://cardstack.com/base/card-api';
import InLocalRealm from './in-local-realm';
import ENV from '@cardstack/host/config/environment';

const { demoRealmURL } = ENV;

interface Signature {
  Args: {
    openFile: FileResource | undefined;
    openDirs: string | undefined;
    path: string | undefined,
    polling: 'off' | undefined,
  }
}

export default class Go extends Component<Signature> {
  <template>
    <div class="main">
      <div class="main__column">
        {{#if demoRealmURL}}
          <FileTree @url={{demoRealmURL}} @path={{@path}} @openDirs={{@openDirs}} @polling={{@polling}} />
        {{else}}
          <InLocalRealm as |url|>
            <FileTree @url={{url}} @path={{@path}} @openDirs={{@openDirs}} @polling={{@polling}} />
          </InLocalRealm>
        {{/if}}
      </div>
      {{#if this.openFile}}
        <div {{monaco content=this.openFile.content
                      language=(getLangFromFileExtension this.openFile.name)
                      contentChanged=this.contentChanged}}>
        </div>
        <div class="main__column">
          {{#if (isRunnable this.openFile.name)}}
            <Module @file={{this.openFile}}/>
          {{else if this.openFileCardJSON}}
            {{#if this.card}}
              <CardEditor
                @card={{this.card}}
                @format="isolated"
                @onSave={{this.onSave}}
              />
            {{/if}}
          {{else if this.jsonError}}
            <h2>Encountered error parsing JSON</h2>
            <pre>{{this.jsonError}}</pre>
          {{/if}}
          <button type="button" {{on "click" this.removeFile}}>Delete</button>
        </div>
      {{/if}}
    </div>
  </template>

  @service declare loaderService: LoaderService;
  @service declare cardService: CardService;
  @tracked jsonError: string | undefined;
  @tracked card: Card | undefined;
  @tracked message: string | undefined;

  constructor(owner: unknown, args: Signature['Args']) {
    super(owner, args);
    languageConfigs.map(lang => extendMonacoLanguage(lang));
  }

  @action
  contentChanged(content: string) {
    if (this.args.openFile?.state === 'ready' && content !== this.args.openFile.content) {
      this.args.openFile.write(content);
    }
  }

  @cached
  get openFileCardJSON() {
    this.jsonError = undefined;
    if (this.args.openFile?.state === 'ready' && this.args.openFile.name.endsWith('.json')) {
      let maybeCard: any;
      try {
        maybeCard = JSON.parse(this.args.openFile.content);
      } catch(err: any) {
        this.jsonError = err.message;
        return undefined;
      }
      if (isCardDocument(maybeCard)) {
        let url = this.args.openFile?.url.replace(/\.json$/, '');
        taskFor(this.loadCard).perform(url);
        return maybeCard;
      }
    }
    return undefined;
  }

  @restartableTask private async loadCard(url: string | undefined): Promise<void> {
    this.card = await this.cardService.loadModel(url);
  }

  @action
  async onSave(card: Card) {
    this.card = card;
  }

  get openFile() {
    if (this.args.openFile?.state !== 'ready') {
      return undefined;
    }
    return this.args.openFile;
  }

  get path() {
    return this.args.path ?? '/';
  }

  @action
  removeFile() {
    if (!this.openFile) { return; }
    taskFor(this.remove).perform(this.openFile.url);
  }

  @restartableTask private async remove(url: string): Promise<void> {
    let headersAccept = this.openFileCardJSON ? 'application/vnd.api+json' : 'application/vnd.card+source';
    url = this.openFileCardJSON ? url.replace(/\.json$/, '') : url;
    let response = await this.loaderService.loader.fetch(url, { method: 'DELETE', headers: { 'Accept': headersAccept }});
    if (!response.ok) {
      throw new Error(`could not delete file, status: ${response.status} - ${response.statusText}. ${await response.text()}`);
    }
  }
}

function isRunnable(filename: string): boolean {
  return ['.gjs', '.js', '.gts', '.ts'].some(extension => filename.endsWith(extension));
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    Go: typeof Go;
   }
}
