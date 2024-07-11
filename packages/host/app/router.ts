import EmberRouter from '@ember/routing/router';
import config from '@cardstack/host/config/environment';
const { ownRealmURL, resolvedOwnRealmURL, hostsOwnAssets } = config;

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

// When resolvedOwnRealmURL is available, that is actually the path in the browser.
// It will not be available when running in fastboot.
// When paths of resolvedOwnRealmURL and ownRealmURL are not symmetrical,
// that means that means the resolvedOwnRealmURL should be used instead of ownRealmURL.
let path = new URL(resolvedOwnRealmURL ?? ownRealmURL).pathname.replace(
  /\/$/,
  '',
);

Router.map(function () {
  this.route('host-freestyle', { path: '/_freestyle' });
  this.route('indexer', { path: '/indexer/:id' });
  this.route('prerender', { path: '/prerender/:card_url' });
  this.route('card', { path: '/*path' });

  // this route is empty but lets the application.hbs render, so that the CardPrerender
  // component exists to support the indexer
  this.route('acceptance-test-setup');

  if (!path || hostsOwnAssets) {
    this.route('index-card', { path: '/' });
  }
});
