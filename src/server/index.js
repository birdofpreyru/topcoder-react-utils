/**
 * Standard web servers.
 */

import 'source-map-support/register';

import _ from 'lodash';
import http from 'http';
import https from 'https';

/* Polyfill required by ReactJS. */
import 'raf/polyfill';

import winston from 'winston';

import serverFactory from './server';
import { SCRIPT_LOCATIONS } from './renderer';

export * from './utils';

/**
 * Normalizes a port into a number, string, or false.
 * @param {String} value Port name or number.
 * @return Port number (Number), name (String), or false.
 */
function normalizePort(value) {
  const port = _.toNumber(value);
  if (_.isFinite(port)) return port; /* port number */
  if (!_.isNumber(port)) return value; /* named pipe */
  return false;
}

/**
 * Creates and starts a new webserver.
 * @param {Object} webpackConfig The Webpack config that was used to build the
 *  frontend bundle.
 * @param {Object} [options] Additional options.
 * @param {Function} [options.Application=null] Optional. The root ReactJS
 *  component of the app to use for server-side rendering.
 * @param {function} [options.cspSettingsHook] Optional. If provided, it will
 *  be called on each request with the default set of CSP policies generated by
 *  server, and it is expected to return the actual set of CSP policies to use.
 * @param {string} [options.defaultLoggerLogLevel='info'] Optional. Log level
 *  for the default logger (created if no 'logger' option provided). Defaults
 *  'info'.
 * @param {Boolean} [options.devMode=false] Whether the server should be
 *  started in the dev mode.
 * @param {String} [options.favicon=""] Path of the favicon to be used by
 *  the server.
 * @param {Object} [options.logger] The logger to use. By default Winston logger
 *  with console transport is used.
 * @param {Object} [options.https=undefined] Optional. If given, HTTPS server
 *  will be started with the specified settings. HTTP server that hanles HTTP >
 *  HTTPS redirection will be also started at the specified port.
 * @param {String} [options.https.cert] SSL Certificate.
 * @param {String} [options.https.key] SSL key.
 * @param {Boolean} [options.httpsRedirect=true] When true, all incoming HTTP
 *  requests will be redirected to HTTPS.
 * @param {Function} [options.beforeRender=null] The hook into server-side
 *  rendering. It will get incoming request as the argument and it should
 *  return a promise that will resolve to the object with the following fields
 *  all optional:
 *    - config {Object} - Config object to be injected into the page;
 *    - extraScripts {Array} - Any additional scripts to be injected into
 *      HTML template;
 *    - initialState {Any} - Initial value of the global state.
 * @param {Number} [options.maxSsrRounds=10] Maximum number of SSR rounds
 *  (the default is set inside the renderer).
 *
 * @param {function} [options.beforeExpressJsSetup] Optional. The callback to be
 *  executed after creation of Express server, before any server configuration
 *  is performed. The server is passed in as the only argument. The callback
 *  can be async.
 * @param {function} [options.onExpressJsSetup] Optional. Custom setup of
 *  ExpressJS server.
 * @param {function} [options.beforeExpressJsError] Optional. The callback to be
 *  called just before the default error handler is added to ExpressJS server.
 *  The server is passed in as the only argument. The callback can be async.
 * @param {String} [options.port=3000] The port to listen (number or name).
 *  When not specified the value will be taken from PORT environmental variable,
 *  or default to 3000 otherwise.
 * @param {function} [options.staticCacheSize=1.e7] Optional. The maximum
 *  static cache size. Defaults to ~10 MB.
 * @param {function} [options.staticCacheController] Optional. Allows to easily
 *  setup and control static server-side caching of SSR-generated HTML markup
 *  with quite rich possibilities.
 * @return {Promise} Resolves to the result object has two fields:
 *  - express {Object} - ExpressJS server;
 *  - httpServer {Object} - NodeJS HTTP(S) server.
 */
async function launch(webpackConfig, options) {
  /* Options normalization. */
  const ops = options ? _.cloneDeep(options) : {};
  ops.port = normalizePort(ops.port || process.env.PORT || 3000);
  _.defaults(ops, {
    httpsRedirect: true,
  });
  if (!ops.staticCacheSize) ops.staticCacheSize = 1.e7;

  if (_.isUndefined(ops.logger)) {
    const { format, transports } = winston;
    ops.logger = winston.createLogger({
      level: ops.defaultLoggerLogLevel || 'info',
      format: format.combine(
        format.splat(),
        format.timestamp(),
        format.colorize(),
        format.printf(
          ({
            level,
            message,
            timestamp,
            stack,
            ...rest
          }) => {
            let res = `${level}\t(at ${timestamp}):\t${message}`;
            if (Object.keys(rest).length) {
              res += `\n${JSON.stringify(rest, null, 2)}`;
            }
            if (stack) res += `\n${stack}`;
            return res;
          },
        ),
      ),
      transports: [new transports.Console()],
    });
  }

  /* Creates servers, resolves and sets the port. */
  const expressServer = await serverFactory(webpackConfig, ops);

  let httpServer;
  if (ops.https) {
    httpServer = https.createServer({
      cert: ops.https.cert,
      key: ops.https.key,
    }, expressServer);
  } else httpServer = http.createServer(expressServer);

  /* Sets error handler for HTTP(S) server. */
  httpServer.on('error', (error) => {
    if (error.syscall !== 'listen') throw error;
    const bind = _.isString(ops.port) ? `Pipe ${ops.port}` : `Port ${ops.port}`;

    /* Human-readable message for some specific listen errors. */
    switch (error.code) {
      case 'EACCES':
        ops.logger.error(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        ops.logger.error(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  /* Listening event handler for HTTP(S) server. */
  httpServer.on('listening', () => {
    const addr = httpServer.address();
    const bind = _.isString(addr) ? `pipe ${addr}` : `port ${addr.port}`;
    ops.logger.info(`Server listening on ${bind} in ${
      process.env.NODE_ENV} mode`);
  });

  httpServer.listen(ops.port);

  return {
    expressServer,
    httpServer,
  };
}

launch.SCRIPT_LOCATIONS = SCRIPT_LOCATIONS;

export default launch;
