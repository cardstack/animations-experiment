import Service, { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import { baseRealm } from '@cardstack/runtime-common';
import { Loader } from '@cardstack/runtime-common/loader';

import config from '@cardstack/host/config/environment';
import { shimExternals } from '@cardstack/host/lib/externals';
import {
  type RealmSessionResource,
  getRealmSession,
} from '@cardstack/host/resources/realm-session';
import MatrixService from '@cardstack/host/services/matrix-service';
import RealmInfoService from '@cardstack/host/services/realm-info-service';

export default class LoaderService extends Service {
  @service declare fastboot: { isFastBoot: boolean };
  @service private declare matrixService: MatrixService;
  @service declare realmInfoService: RealmInfoService;

  @tracked loader = this.makeInstance();
  // This resources all have the same owner, it's safe to reuse cache.
  // The owner is the service, which stays around for the whole lifetime of the host app,
  // which in turn assures the resources will not get torn down.
  private realmSessions: Map<string, RealmSessionResource> = new Map();

  reset() {
    if (this.loader) {
      this.loader = this.loader.clone();
      shimExternals(this.loader);
    } else {
      this.loader = this.makeInstance();
    }
  }

  private makeInstance() {
    if (this.fastboot.isFastBoot) {
      let loader = new Loader();
      shimExternals(loader);
      return loader;
    }

    let loader = new Loader();
    loader.addURLMapping(
      new URL(baseRealm.url),
      new URL(config.resolvedBaseRealmURL),
    );

    loader.registerURLHandler((req) => this.fetchWithAuth(req));

    shimExternals(loader);

    return loader;
  }

  private async fetchWithAuth(request: Request) {
    // To avoid deadlock, we can assume that any GET requests to baseRealm don't need authentication.
    let isGetRequestToBaseRealm =
      request.url.includes(baseRealm.url) && request.method === 'GET';
    if (
      isGetRequestToBaseRealm ||
      request.url.endsWith('_session') ||
      request.method === 'HEAD' ||
      request.headers.has('Authorization')
    ) {
      return null;
    }
    let realmURL = await this.realmInfoService.fetchRealmURL(request.url);
    if (!realmURL) {
      return null;
    }

    // We have to get public readable status
    // before we instatiate realm resource and load realm token.
    // Because we don't want to do authentication
    // for GET request to publicly readable realm.
    let isPublicReadable = await this.realmInfoService.isPublicReadable(
      realmURL,
    );
    if (request.method === 'GET' && isPublicReadable) {
      return null;
    }

    await this.matrixService.ready;
    if (!this.matrixService.isLoggedIn) {
      return null;
    }

    let realmSession = await this.getRealmSession(realmURL);
    if (!realmSession.rawRealmToken) {
      return null;
    }

    request.headers.set('Authorization', realmSession.rawRealmToken);
    let body;
    if (request.bodyUsed) {
      body = null;
    } else if (request.headers.get('content-type') === 'application/json') {
      body = JSON.stringify(await request.json());
    } else {
      body = await request.text();
    }
    return await this.loader.fetch(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body,
    });
  }

  private async getRealmSession(realmURL: URL) {
    let realmURLString = realmURL.href;
    let realmSession = this.realmSessions.get(realmURLString);

    if (!realmSession) {
      realmSession = getRealmSession(this, {
        realmURL: () => realmURL,
      });
      await realmSession.loaded;
      this.realmSessions.set(realmURLString, realmSession);
    }
    return realmSession;
  }
}
