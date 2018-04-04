/**
 * ExpressJS middleware for server-side rendering of a ReactJS app.
 */

import _ from 'lodash';
import config from 'config';
import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import React from 'react';
import serializeJs from 'serialize-javascript';

import { Helmet } from 'react-helmet';
import { Provider } from 'react-redux';
import { StaticRouter } from 'react-router-dom';

const sanitizedConfig = _.omit(config, 'SECRET');

/**
 * Reads build-time information about the app. This information is generated
 * by our standard Webpack config for apps, and it is written into
 * ".build-info" file in the context folder specified in Webpack config.
 * At the moment, that file contains build timestamp and a random 32-bit key,
 * suitable for cryptographical use.
 * @param {String} context Webpack context path used during the build.
 * @return {Promise} Resolves to the build-time information.
 */
/* TODO: Use sync read, to simplify related code. */
function getBuildInfo(context) {
  const url = path.resolve(context, '.build-info');
  return new Promise((resolve, reject) => {
    fs.readFile(url, (err, info) => {
      if (err) reject(err);
      else resolve(JSON.parse(info));
    });
  });
}

/**
 * Prepares a new Cipher for data encryption.
 * @param {String} key Encryption key (32-bit random key is expected, see
 *  node-forge documentation, in case of doubts).
 * @return {Promise} Resolves to the object with two fields:
 *  1. cipher - a new Cipher, ready for encryption;
 *  2. iv - initial vector used by the cipher.
 */
function prepareCipher(key) {
  return new Promise((resolve, reject) => {
    forge.random.getBytes(32, (err, iv) => {
      if (err) reject(err);
      else {
        // console.log('KEY', key);
        const cipher = forge.cipher.createCipher('AES-CBC', key);
        cipher.start({ iv });
        resolve({ cipher, iv });
      }
    });
  });
}

/**
 * Creates the middleware.
 * @param {Object} webpackConfig
 * @param {Object} options Additional options:
 * @return {Promise} Resolves to the middleware.
 */
export default async function factory(webpackConfig, options) {
  const buildInfo = await getBuildInfo(webpackConfig.context);

  global.TRU_BUILD_INFO = buildInfo;
  // console.log('BUILD INFO', buildInfo);

  const ops = _.defaults(_.clone(options), {
    beforeRender: () => Promise.resolve({}),
  });

  return async (req, res) => {
    const [{
      configToInject,
      extraScripts,
      store,
    }, {
      cipher,
      iv,
    }] = await Promise.all([
      ops.beforeRender(req, sanitizedConfig),
      prepareCipher(buildInfo.key),
    ]);

    /* Context for react-router and collection of data related to server-side
     * rendering (this will be moved into separate place in future). */
    const context = {
      /* Array of chunk names, to use for stylesheet links injection. */
      chunks: [],

      /* Pre-rendered HTML markup for dynamic chunks. */
      splits: {},
    };

    let helmet;

    /* Optional server-side rendering. */
    let App = options.Application;
    if (App) {
      App = (
        <StaticRouter
          context={context}
          location={req.url}
        >
          <App />
        </StaticRouter>
      );

      if (store) App = <Provider store={store}>{App}</Provider>;

      /* This takes care about server-side rendering of page title and meta tags
       * (still demands injection into HTML template, which happens below). */
      helmet = Helmet.renderStatic();
    }

    /* Encrypts data to be injected into HTML.
     * Keep in mind, that this encryption is no way secure: as the JS bundle
     * contains decryption key and is able to decode it at the client side.
     * Hovewer, for a number of reasons, encryption of injected data is still
     * better than injection of a plain text. */
    cipher.update(forge.util.createBuffer(JSON.stringify({
      CONFIG: configToInject || sanitizedConfig,
      ISTATE: store ? store.getState() : null,
    }), 'utf8'));
    cipher.finish();
    const INJ = forge.util.encode64(`${iv}${cipher.output.data}`);

    if (context.status) res.status(context.status);
    const styles = context.chunks.map(chunk => (
      `<link data-chunk="${chunk}" href="/${chunk}.css" rel="stylesheet" />`
    )).join('');

    /* It is supposed to end with '/' symbol as path separator. */
    const { publicPath } = webpackConfig.output;

    res.send((
      `<!DOCTYPE html>
      <html>
        <head>
          ${helmet ? helmet.title.toString() : ''}
          ${helmet ? helmet.meta.toString() : ''}
          <link
            href="${publicPath}main.css"
            rel="stylesheet"
          />
          ${styles}
          <link rel="shortcut icon" href="/favicon.ico" />
          <meta charset="utf-8" />
          <meta
            content="width=device-width,initial-scale=1.0"
            name="viewport"
          />
        </head>
        <body>
          <div id="react-view">${App || ''}</div>
          <script id="inj" type="application/javascript">
            window.SPLITS = ${serializeJs(context.splits, { isJSON: true })}
            window.INJ="${INJ}"
          </script>
          <script
            src="${publicPath}polyfills.js"
            type="application/javascript"
          ></script>
          ${extraScripts ? extraScripts.join('') : ''}
          <script
            src="${publicPath}main.js" 
            type="application/javascript"
          ></script>
        </body>
      </html>`
    ));
  };
}
