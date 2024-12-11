import { Addon } from '@embroider/addon-dev/rollup';
import { babel } from '@rollup/plugin-babel';
import { scopedCSS } from 'glimmer-scoped-css/rollup';
import copy from 'rollup-plugin-copy';
import css from 'rollup-plugin-import-css';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

export default {
  // This provides defaults that work well alongside `publicEntrypoints` below.
  // You can augment this if you need to.
  output: addon.output(),

  plugins: [
    scopedCSS('src'),
    css(),

    // These are the modules that users should be able to import from your
    // addon. Anything not listed here may get optimized away.
    addon.publicEntrypoints([
      'components.js',
      'helpers.js',
      'icons.js',
      'modifiers.js',
      'usage.js',
    ]),

    // These are the modules that should get reexported into the traditional
    // "app" tree. Things in here should also be in publicEntrypoints above, but
    // not everything in publicEntrypoints necessarily needs to go here.
    addon.appReexports([]),

    // Follow the V2 Addon rules about dependencies. Your code can import from
    // `dependencies` and `peerDependencies` as well as standard Ember-provided
    // package names.
    addon.dependencies(),

    // Ensure that standalone .hbs files are properly integrated as Javascript.
    addon.hbs(),

    // Ensure that .gjs files are properly integrated as Javascript
    addon.gjs(),

    // addons are allowed to contain imports of .css files, which we want rollup
    // to leave alone and keep in the published output.
    addon.keepAssets(
      [
        'styles/**/*.css',
        '**/*.css',
        '**/*.otf',
        '**/*.png',
        '**/*.webp',
        '**/*.woff2',
      ],
      'default',
    ),

    // Remove leftover build artifacts when starting a new build.
    addon.clean({ runOnce: true }),

    // Copy Readme and License into published package
    copy({
      targets: [
        { src: '../README.md', dest: '.' },
        { src: '../LICENSE.md', dest: '.' },
      ],
    }),

    // This babel config should *not* apply presets or compile away ES modules.
    // It exists only to provide development niceties for you, like automatic
    // template colocation.
    //
    // By default, this will load the actual babel config from the file
    // babel.config.json.
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.gjs', '.ts', '.gts'],
    }),
  ],

  onLog(level, log, handler) {
    if (log.code === 'UNUSED_EXTERNAL_IMPORT') {
      // Turn unused external imports from warnings to errors. Warnings
      // accumulate and just generate noise. And this is an easily-fixable issue
      // usually caused by failing to declare a type import correctly.
      level = 'error';
    }
    handler(level, log);
  },
};
