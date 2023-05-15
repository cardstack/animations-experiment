'use strict';

module.exports = function (environment) {
  const ENV = {
    modulePrefix: '@cardstack/host',
    environment,
    rootURL: '/',
    locationType: 'history',
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
      },
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    },
    'ember-cli-mirage': {
      enabled: false,
    },
    logLevels: process.env.LOG_LEVELS || '*=info,current-run=error',
    matrixURL: process.env.MATRIX_URL || 'http://localhost:8008',

    // the fields below may be rewritten by the realm server
    ownRealmURL:
      environment === 'test'
        ? 'http://test-realm/test/'
        : process.env.OWN_REALM_URL || 'http://localhost:4200/', // this should be provided as an *unresolved* URL
    hostsOwnAssets: true,
    isLocalRealm: process.env.HOST_LOCAL_REALM === 'true',
    resolvedBaseRealmURL:
      process.env.RESOLVED_BASE_REALM_URL || 'http://localhost:4201/base/',
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
    ENV.logLevels = '*=warn,current-run=error';
  }

  return ENV;
};
