import path from 'node:path';
import Encore from '@symfony/webpack-encore';

if (!Encore.isRuntimeEnvironmentConfigured()) {
  Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore.setOutputPath('public/build/')
  .setPublicPath('/build')
  // The whole React app (Feature-Sliced Design under assets/react), mounted by templates/spa.html.twig.
  .addEntry('spa', './assets/react/app/index.tsx')
  // The legacy Twig pages, one entry each: an item that replaces a screen deletes its entry; item 12 removes the
  // rest (docs/pdr/prd-restructure.md).
  .addEntry('app', './assets/js/app.js')
  // No split chunks and one runtime per entry while the legacy templates load build/<entry>.js by hand: each entry
  // must be self-contained. Item 12 switches to splitEntryChunks() + enableSingleRuntimeChunk() as tacoma does.
  .disableSingleRuntimeChunk()
  // Babel 8's React preset otherwise picks dev mode from BABEL_ENV/NODE_ENV (unset during "encore production") and
  // emits jsxDEV calls, which React's production build doesn't have.
  .enableReactPreset((options) => {
    options.development = !Encore.isProduction();
    options.runtime = 'automatic';
  })
  // .ts/.tsx compile through Babel; types are checked apart, by `npm run typecheck`.
  .enableBabelTypeScriptPreset()
  .cleanupOutputBeforeBuild()
  .enableSourceMaps(!Encore.isProduction())
  .enableVersioning(Encore.isProduction())
  .configureBabel((config) => {
    config.plugins.push([
      'polyfill-corejs3',
      {method: 'usage-global', version: '3.49'},
    ]);
  })
  .addAliases({'@': path.resolve(import.meta.dirname, 'assets/react')});

const config = await Encore.getWebpackConfig();
// package.json is "type": "module", which makes webpack parse every .js file as a strict ES module: no require(), no
// extensionless imports, no CommonJS default-import interop. The legacy scripts rely on all three, so they are parsed
// as before. Removed by item 12 with assets/js.
config.module.rules.push({
  test: /\.js$/,
  include: path.resolve(import.meta.dirname, 'assets/js'),
  type: 'javascript/auto',
  resolve: {fullySpecified: false},
});

export default config;
