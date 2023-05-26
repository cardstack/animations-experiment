'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { compatBuild } = require('@embroider/compat');
const { Webpack } = require('@embroider/webpack');
const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');
const { GlimmerScopedCSSWebpackPlugin } = require('glimmer-scoped-css/webpack');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    'ember-cli-babel': {
      enableTypeScriptTransform: true,
    },
  });
  return compatBuild(app, Webpack, {
    staticAddonTrees: true,
    staticAddonTestSupportTrees: true,
    staticHelpers: true,

    // needed to disable this to get embroider's resolver happy with gjs
    staticComponents: false,

    staticModifiers: true,
    staticAppPaths: ['lib'],

    packagerOptions: {
      ...{
        webpackConfig: {
          devtool: 'source-map',
          module: {
            rules: [
              {
                test: /\.ttf$/,
                type: 'asset',
              },
            ],
          },
          plugins: [
            new MonacoWebpackPlugin(),
            new webpack.ProvidePlugin({
              process: 'process',
            }),
            new MomentLocalesPlugin({
              // 'en' is built into moment and cannot be removed. This strips the others.
              localesToKeep: [],
            }),
            new GlimmerScopedCSSWebpackPlugin(),
          ],
          resolve: {
            fallback: {
              fs: false,
              path: require.resolve('path-browserify'),
              crypto: require.resolve('crypto-browserify'),
              stream: require.resolve('stream-browserify'),
              process: false,
            },
          },
          resolveLoader: {
            alias: {
              'glimmer-scoped-css/virtual-loader': require.resolve(
                'glimmer-scoped-css/virtual-loader'
              ),
            },
          },
          node: {
            global: true,
          },
        },
      },
    },
  });
};
