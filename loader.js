const fs = require('fs-extra')
const _ = require('lodash')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const CT = require('ctvault')

const config = require('./config')
const manager = require('./managers')
const { errorHandler } = require('./middleware')

// _.nmap = (arr, fn) => {
//     let mapped = _.map(arr, fn)
//     return _.filter
// }

let loadModules = async (app) => {
    await CT.ensureVault()

    // use body-parser since we are expecting JSON input
    app.use(bodyParser.text({ type: 'text/plain' }));
    app.use(bodyParser.json())

    // CORS support
    app.use(cors());

    // app.use('/api', (req, res, next) => {
    //     res.header('Access-Control-Allow-Origin', '*');
    //     res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    //     res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    //     if ('options' === req.method || 'OPTIONS' === req.method) {
    //         res.status(200).send();
    //     }
    //     else {
    //         manager.handle(req, res, next)
    //     }
    // })
    app.use('/api', manager.handle)
    app.use(errorHandler)

    let scaffoldModuleDir = config.get('CT_SCAFFOLD_MODULE_DIR')

    if (!scaffoldModuleDir) {
        logger.error(`Couldn't find scaffold module directory.  Check your CT_SCAFFOLD_MODULE_DIR`)
        process.exit(0)
    }

    let directories = _.filter(fs.readdirSync(scaffoldModuleDir, { withFileTypes: true }), dir => dir.isDirectory() && _.includes(fs.readdirSync(`${scaffoldModuleDir}/${dir.name}`), 'scaffold.js'))

    let loadDir = async entry => {
        const indexPath = `${scaffoldModuleDir}/${entry.name}/scaffold.js`
        if (fs.existsSync(indexPath)) {
            const serviceConfig = require(indexPath)
            manager.registerServiceConfig(serviceConfig)

            if (serviceConfig.public && serviceConfig.public.path) {
                const publicPath = `${scaffoldModuleDir}/${entry.name}/${serviceConfig.public.path}`
                if (fs.existsSync(publicPath)) {
                    app.use(`/${serviceConfig.public.name}`, express.static(publicPath))
                }
            }
        }
    }

    await Promise.all(_.map(directories, await loadDir))
}

module.exports = loadModules
