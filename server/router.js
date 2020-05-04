const fs = require('fs-extra')
const _ = require('lodash')
const express = require('express')
const middleware = require('./middleware')

let router = express.Router()
let routes = []

router.processPubSub = require('./subscriber')(router)

let scaffoldModuleDir = (`${__dirname}/../modules`)
let directories = _.map(_.filter(fs.readdirSync(scaffoldModuleDir, { withFileTypes: true }), dir => dir.isDirectory() && _.includes(fs.readdirSync(`${scaffoldModuleDir}/${dir.name}`), 'scaffold.js')), e => `${scaffoldModuleDir}/${e.name}`)

// local method declarations
let register = (type, module) => service => {
    service.module = module
    service.type = type
    service.method = (service.method || 'get').toLowerCase()

    if (service.type === 'subscriptions') {
        service.method = 'sub'
    }

    routes.push(service)

    logger.debug(`[ reg ] module [ ${module} ] [ ${service.method.toUpperCase()} ${service.path || service.key} ]`)

    switch (type) {
        case 'extensions':
        case 'microservices':
        case 'admin':
            router[service.method](`/api${service.path}`, middleware.checkRequiredParameters(service))
            router[service.method](`/api${service.path}`, async (req, res) => {
                let handler = service.handler
                if (service.triggers) {
                    let typeTriggers = service.triggers[req.body.resource && req.body.resource.typeId]
                    handler = (typeTriggers && typeTriggers[req.body.action]) || handler
                }
                let results = type === 'admin' ? await handler(req.data, req.ct, router) : await handler(req.data, req.ct)
                let response = type === 'extensions' ? { actions: results } : results
                res.status(200).json(response)
            })
            break;
        case 'web':
            router.use(`/${service.name}`, express.static(`${scaffoldModuleDir}/${module}/${service.path}`.replace('//', '/')))
            break;
        case 'mc':
            router.use(`/:projectKey/${service.name}`, express.static(`${scaffoldModuleDir}/${module}/${service.path}`.replace('//', '/')))
            break;
    }
}

let loadDir = dir => {
    const indexPath = `${dir}/scaffold.js`
    if (fs.existsSync(indexPath)) {
        let module = _.last(dir.split('/'))
        const serviceConfig = require(indexPath)
        _.each(Object.keys(serviceConfig), key => _.each(Array.ensureArray(serviceConfig[key]), register(key, module)))
    }
}
// end local method declaration

// if the scaffold module dir doesn't exist create it
if (!fs.existsSync(scaffoldModuleDir)) {
    fs.mkdirSync(scaffoldModuleDir)
}

router.use('/api', middleware.readCTConfiguration)

if (directories.length > 0) {
    // load each module directory
    _.each(directories, loadDir)
}
else {
    // load the root module directory if this is a single service deployment
    loadDir(scaffoldModuleDir)
}

// load scaffold services (metadata)
loadDir(`${__dirname}/services`)

router.get('/api', (req, res) => res.json(routes))
router.getService = key => _.first(_.filter(routes, k => k.key === key))

module.exports = router