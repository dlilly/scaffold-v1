const fs = require('fs-extra')
const _ = require('lodash')
const config = require('../config')

const CT = require('ctvault')
const express = require('express')

class Manager {
    constructor(opts = {}) {
        this.opts = opts
        this.items = []
        this.managers = []
        this.key = 'manager'
    }

    async load() {
        this.router = express.Router()

        this.manage(require('./extensions')(this.router))
        this.manage(require('./subscriptions')(this.router))
        this.manage(require('./microservices')(this.router))
        this.manage(require('./credentials')(this.router))

        _.each(this.managers, manager => {
            _.each(manager.opts.routes, route => {
                route.path = `/${manager.key}${route.relativePath}`
                this.register(route)
            })
        })

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
                this.registerServiceConfig(serviceConfig)
    
                if (serviceConfig.public && serviceConfig.public.path) {
                    const publicPath = `${scaffoldModuleDir}/${entry.name}/${serviceConfig.public.path}`
                    if (fs.existsSync(publicPath)) {
                        this.router.use(`/${serviceConfig.public.name}`, express.static(publicPath))
                    }
                }
            }
        }
    
        await Promise.all(_.map(directories, await loadDir))
    }

    register(item) {
        item.method = (item.method || 'get').toLowerCase()
        
        this.items.push(item)
        if (item.path && this.router) {
            let apiPath = `/api${item.path}`
            console.log(`register ${item.method} [ ${apiPath} ]`)
            this.router[item.method](apiPath, this.handle(item))
        }
    }

    registerMany(itemArray) {
        _.each(itemArray, this.register.bind(this))
    }

    registerServiceConfig(serviceConfig) {
        this.registerMany(serviceConfig.extensions)
        this.registerMany(serviceConfig.subscribers)
        this.registerMany(serviceConfig.microservices)
    }

    get(key) {
        return _.first(_.filter(this.items, x => x.key === key))
    }

    getManager(key) {
        return _.first(_.filter(this.managers, m => m.key === key))
    }

    manage(manager) {
        this.managers.push(manager)
    }

    handle(item) {
        return async (req, res, next) => {
            if (!item) {
                logger.error(`Couldn't figure out where to send me: ${req.path}`)
                return res.status(200).json({ actions: [] })
            }
            
            try {           
                let projectKey = req.headers['authorization'] || req.headers['x-ctvault-client-id']
                let ct = item.isAdmin ? {} : await CT.getClient(projectKey)

                let data = { 
                    params: {
                        ...req.query,
                        ...req.params
                    },
                    object: req.body.resource && req.body.resource.obj || req.body
                }

                if (item.requiredParameters) {
                    let missingParameters = _.filter(item.requiredParameters, param => !req.query[param])
                    if (missingParameters.length > 0) {
                        return next({ error: `Missing parameters: [${missingParameters.join(',')}]` })
                    }
                }

                // let handler = mm.manager.getHandler(data.action, data.resource && data.resource.typeId, mm.item)
                item.getHandler = () => {
                    if (item.triggers) {
                        let typeTriggers = item.triggers[req.body.resource && req.body.resource.typeId]
                        if (typeTriggers) {
                            let actionTrigger = typeTriggers[req.body.action]
                            if (actionTrigger) {
                                return actionTrigger
                            }
                        }
                    }
            
                    return item.handler
                }

                let handler = item.getHandler()
                let response = await handler(data, ct)
                res.status(200).json(response)
            } catch (error) {
                console.error(error.stack)
                return next(error.message)
            }
        }
    }
}

module.exports = Manager