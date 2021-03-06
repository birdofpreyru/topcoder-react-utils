/**
 * @category Configs
 * @module webpack/app-development
 * @desc development Webpack configuration for applications.
 */
const _ = require('lodash');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const webpack = require('webpack');
const { merge } = require('webpack-merge');

const baseFactory = require('./app-base');

/**
 * @func configFactory
 * @desc
 * ```js
 * const configFactory = require('@dr.pogodin/react-utils/config/webpack/app-development');
 * ```
 * Creates development Webpack configuration for applications. It is based on
 * {@link module:webpack/app-base webpack/app-base}, and differs form that in
 * the following:
 * - *development* Babel environment is enforced, and sets
 *   `[path][name]___[local]___[hash:base64:6]` as the default value of
 *   `cssLocalIdent` argument for the base config.
 *   - [`webpack-hot-middleware/client?reload=true`](https://github.com/glenjamin/webpack-hot-middleware)
 * - Emulates the following environment variables:
 *   - **`BABEL_ENV`** &mdash; It is set to *development* to inform any
 *     interested code that it is running in dev mode;
 *   - **`NODE_ENV`** &mdash; It is set to *development*.
 * - Adds the following plugins:
 *   - [HotModuleReplacementPlugin](https://webpack.js.org/plugins/hot-module-replacement-plugin/);
 *   - [NamedModulesPlugin](https://webpack.js.org/plugins/named-modules-plugin/).
 * @param {object} ops Config options, the saeme options as in the base config
 * are accepted.
 */
module.exports = function configFactory(ops) {
  const o = _.defaults(_.clone(ops), {
    cssLocalIdent: '[package]___[path][name]___[local]___[hash:base64:6]',
  });

  const entry = [
    '@dr.pogodin/react-utils/build/development/client/init',
    'webpack-hot-middleware/client?reload=true',
    ...Array.isArray(o.entry) ? o.entry : [o.entry],
  ];

  const res = merge(baseFactory({
    ...o,
    babelEnv: 'development',
    entry,
    mode: 'development',
  }), {
    output: {
      chunkFilename: '[id].js',
      filename: '[id].js',
    },
    plugins: [
      new MiniCssExtractPlugin({
        chunkFilename: '[id].css',
        filename: '[id].css',
      }),
      new webpack.DefinePlugin({
        'process.env.BABEL_ENV': JSON.stringify('development'),
        'process.env.DEV_TOOLS': JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.REACT_GLOBAL_STATE_DEBUG': JSON.stringify(true),
      }),
      new webpack.HotModuleReplacementPlugin(),
      new ReactRefreshPlugin({
        overlay: {
          sockIntegration: 'whm',
        },
      }),
    ],
    snapshot: {
      // This enforces Webpack to watch for possible changes in node_modules
      // dependencies, which is a great convenience in library-centric dev
      // workflows.
      managedPaths: [],
    },
  });
  return res;
};
