import Component from '@glimmer/component';
import { didCancel, enqueueTask } from 'ember-concurrency';
import { service } from '@ember/service';
import { CurrentRun } from '../lib/current-run';
import { readFileAsText as _readFileAsText } from '@cardstack/runtime-common/stream';
import { hasExecutableExtension } from '@cardstack/runtime-common';
import {
  type EntrySetter,
  type Reader,
  type RunState,
  type RunnerOpts,
} from '@cardstack/runtime-common/search-index';
import type RenderService from '../services/render-service';
import type LoaderService from '../services/loader-service';
import type LocalRealm from '../services/local-realm';
import type { LocalPath } from '@cardstack/runtime-common/paths';

export default class CardPrerender extends Component {
  @service declare loaderService: LoaderService;
  @service declare renderService: RenderService;
  @service declare fastboot: { isFastBoot: boolean };
  @service declare localRealm: LocalRealm;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    if (this.fastboot.isFastBoot) {
      try {
        this.doRegistration.perform();
      } catch (e: any) {
        if (!didCancel(e)) {
          throw e;
        }
        throw new Error(
          `card-prerender component is missing or being destroyed before runner registration was completed`
        );
      }
    } else {
      this.localRealm.setupIndexing(
        this.fromScratch.bind(this),
        this.incremental.bind(this)
      );
    }
  }

  private async fromScratch(realmURL: URL): Promise<RunState> {
    try {
      let state = await this.doFromScratch.perform(realmURL);
      return state;
    } catch (e: any) {
      if (!didCancel(e)) {
        throw e;
      }
    }
    throw new Error(
      `card-prerender component is missing or being destroyed before from scratch index of realm ${realmURL} was completed`
    );
  }

  private async incremental(
    prev: RunState,
    url: URL,
    operation: 'delete' | 'update'
  ): Promise<RunState> {
    if (hasExecutableExtension(url.href) && !this.fastboot.isFastBoot) {
      this.loaderService.reset();
    }
    try {
      let state = await this.doIncremental.perform(prev, url, operation);
      return state;
    } catch (e: any) {
      if (!didCancel(e)) {
        throw e;
      }
    }
    throw new Error(
      `card-prerender component is missing or being destroyed before incremental index of ${url} was completed`
    );
  }

  private doRegistration = enqueueTask(async () => {
    let optsId = (globalThis as any).runnerOptsId;
    if (optsId == null) {
      throw new Error(`Runner Options Identifier was not set`);
    }
    let register = getRunnerOpts(optsId).registerRunner;
    await register(this.fromScratch.bind(this), this.incremental.bind(this));
  });

  private doFromScratch = enqueueTask(async (realmURL: URL) => {
    let { reader, entrySetter } = this.getRunnerParams();
    let current = await CurrentRun.fromScratch(
      new CurrentRun({
        realmURL,
        loader: this.loaderService.loader,
        reader,
        entrySetter,
        renderCard: this.renderService.renderCard.bind(this.renderService),
      })
    );
    this.renderService.indexRunDeferred?.fulfill();
    return current;
  });

  private doIncremental = enqueueTask(
    async (prev: RunState, url: URL, operation: 'delete' | 'update') => {
      let { reader, entrySetter } = this.getRunnerParams();
      let current = await CurrentRun.incremental({
        url,
        operation,
        prev,
        reader,
        loader: this.loaderService.loader,
        entrySetter,
        renderCard: this.renderService.renderCard.bind(this.renderService),
      });
      this.renderService.indexRunDeferred?.fulfill();
      return current;
    }
  );

  private getRunnerParams(): {
    reader: Reader;
    entrySetter: EntrySetter;
  } {
    if (this.fastboot.isFastBoot) {
      let optsId = (globalThis as any).runnerOptsId;
      if (optsId == null) {
        throw new Error(`Runner Options Identifier was not set`);
      }
      return {
        reader: getRunnerOpts(optsId).reader,
        entrySetter: getRunnerOpts(optsId).entrySetter,
      };
    } else {
      let self = this;
      function readFileAsText(
        path: LocalPath,
        opts?: { withFallbacks?: true }
      ): Promise<{ content: string; lastModified: number } | undefined> {
        return _readFileAsText(
          path,
          self.localRealm.adapter.openFile.bind(self.localRealm.adapter),
          opts
        );
      }
      return {
        reader: {
          readdir: this.localRealm.adapter.readdir.bind(
            this.localRealm.adapter
          ),
          readFileAsText,
        },
        entrySetter: this.localRealm.setEntry.bind(this.localRealm),
      };
    }
  }
}

function getRunnerOpts(optsId: number): RunnerOpts {
  return ((globalThis as any).getRunnerOpts as (optsId: number) => RunnerOpts)(
    optsId
  );
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CardPrerender: typeof CardPrerender;
  }
}
