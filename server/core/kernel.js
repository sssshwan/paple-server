const _ = require('lodash')
const EventEmitter = require('events')

/* global WIKI */

module.exports = {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info(`======= ${_.padEnd('Paple server is started'+ ' ', 31, '=')}`)
    WIKI.logger.info('=======================================')
    WIKI.logger.info('Initializing...')

    WIKI.models = require('./db').init()

    try {
      await WIKI.models.onReady
      await WIKI.configSvc.loadFromDb()
      await WIKI.configSvc.applyFlags()
    } catch (err) {
      WIKI.logger.error('Database Initialization Error: ' + err.message)
      if (WIKI.IS_DEBUG) {
        console.error(err)
      }
      process.exit(1)
    }

    this.bootMaster()
  },
  /**
   * Pre-Master Boot Sequence
   */
  async preBootMaster() {
    try {
      await this.initTelemetry()
      WIKI.cache = require('./cache').init()
      WIKI.scheduler = require('./scheduler').init()
      WIKI.sideloader = require('./sideloader').init()
      WIKI.events = new EventEmitter()
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Boot Master Process
   */
  /* ignore setup */
  async bootMaster() {
    try {
      //if (WIKI.config.setup) {
      if (WIKI.config.setup){  
        WIKI.logger.info('Starting setup wizard...')
        require('../setup')()
      } else {
        await this.preBootMaster()
        await require('../master')()
        this.postBootMaster()
      }
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Post-Master Boot Sequence
   */
  async postBootMaster() {
    await WIKI.models.analytics.refreshProvidersFromDisk()
    await WIKI.models.authentication.refreshStrategiesFromDisk()
    await WIKI.models.editors.refreshEditorsFromDisk()
    await WIKI.models.loggers.refreshLoggersFromDisk()
    await WIKI.models.renderers.refreshRenderersFromDisk()
    await WIKI.models.searchEngines.refreshSearchEnginesFromDisk()
    await WIKI.models.storage.refreshTargetsFromDisk()

    await WIKI.auth.activateStrategies()
    await WIKI.models.searchEngines.initEngine()
    await WIKI.models.storage.initTargets()
    WIKI.scheduler.start()
  },
  /**
   * Init Telemetry
   */
  async initTelemetry() {
    require('./telemetry').init()

    process.on('unhandledRejection', (err) => {
      WIKI.logger.warn(err)
      WIKI.telemetry.sendError(err)
    })
    process.on('uncaughtException', (err) => {
      WIKI.logger.warn(err)
      WIKI.telemetry.sendError(err)
    })
  }
}
