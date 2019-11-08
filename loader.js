const fs = require('fs-extra')
const _ = require('lodash')
const stringify = require('json-stringify-safe')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const config = require('./config')

const { errorHandler } = require('./middleware')

let loadModules = async (app) => {
    global.manager = require('./managers')

    // use body-parser since we are expecting JSON input
    app.use(bodyParser.text({ type: 'text/plain' }));
    app.use(bodyParser.json())

    app.use('/api', manager.handle)
    app.use(errorHandler)

    // CORS support
    app.use(cors());

    let scaffoldModuleDir = config.get('CT_SCAFFOLD_MODULE_DIR')
    let directories = _.filter(fs.readdirSync(scaffoldModuleDir, { withFileTypes: true }), dir => {
        if (dir.isDirectory()) {
            return _.includes(fs.readdirSync(`${scaffoldModuleDir}/${dir.name}`), 'scaffold.js')
        }
        else {
            return false
        }
    })

    let loadDir = async entry => {
        const indexPath = `${scaffoldModuleDir}/${entry.name}/scaffold.js`
        if (fs.existsSync(indexPath)) {
            const serviceConfig = require(indexPath)
            manager.registerServiceConfig(serviceConfig)

            if (serviceConfig.public && serviceConfig.public.path) {
                const publicPath = `${entry.name}/${serviceConfig.public.path}`
                if (fs.existsSync(publicPath)) {
                    app.use(`/${serviceConfig.public.name || entry.name}`, express.static(publicPath))
                }
            }
        }
    }

    await Promise.all(_.map(directories, await loadDir))
}

module.exports = loadModules
