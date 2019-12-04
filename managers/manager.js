const _ = require('lodash')

const CT = require('ctvault')

class Manager {
    constructor() {
        this.items = []
        this.managers = []
        this.key = 'manager'
    }

    register = item => {
        item.type = this.key

        if (item.relativePath) {
            item.path = `/${this.key}/${item.relativePath}`
        }

        this.items.push(item)
    }

    registerMany = itemArray => {
        _.each(itemArray, this.register)
    }

    registerServiceConfig(serviceConfig) {
        this.getManager('extensions').registerMany(serviceConfig.extensions)
        this.getManager('subscriptions').registerMany(serviceConfig.subscribers)
        this.getManager('microservices').registerMany(serviceConfig.microservices)
    }

    get = key => {
        return _.first(_.filter(this.items, x => x.key === key))
    }

    getManager(key) {
        return _.first(_.filter(this.managers, m => m.key === key))
    }

    getByRequest(req) {
        let filtered = _.filter(this.items, x => {
            let match = req.method.toLowerCase() === 'get' || (x.method && x.method.toLowerCase()) === req.method.toLowerCase()
            if (x.path) {
                let xparts = x.path.split('/')
                let pparts = req.path.split('/')

                if (xparts.length !== pparts.length) {
                    match = false
                }
                else {
                    for (const [index, xpart] of xparts.entries()) {
                        if (xpart.indexOf(':') === 0) {
                            if (_.isEmpty(pparts[index])) {
                                match = false
                                break;
                            }
    
                            let key = xpart.replace(':', '')
                            x.params = x.params || {}
                            x.params[key] = pparts[index]
                        }
                        else {
                            if (xpart !== pparts[index]) {
                                match = false
                                break;
                            }
                        }
                    }
                }
            }
            else {
                match = false
            }
            return match
        })

        return { manager: this, item: _.first(filtered) }
    }

    manage = manager => {
        this.managers.push(manager)
    }

    handleRequest = () => {
        logger.debug(`you need to override handleRequest()`)
    }

    getHandler = () => {
        logger.debug(`you need to override getHandler()`)
    }

    handle = async (req, res, next) => {
        // find the extension that handles this path
        let mappedManagers = _.map(this.managers, m => m.getByRequest(req))
        let mm = _.first(_.filter(mappedManagers, m => m.item))
        
        if (!mm || !mm.manager) {
            logger.error(`Couldn't figure out where to send me: ${req.path}`)
            return res.status(200).json({ actions: [] })
        }
        
        try {
            let projectKey = req.headers['authorization'] || req.headers['x-ctvault-client-id']
            let ct = await CT.getClient(projectKey)
            
            if (mm.item) {
                let data = { 
                    ...req.query, 
                    ...req.body,
                    params: mm.item.params,
                    object: req.body.resource && req.body.resource.obj
                }

                if (mm.item.requiredParameters) {
                    let missingParameters = _.filter(mm.item.requiredParameters, param => !req.query[param])
                    if (missingParameters.length > 0) {
                        return next({ error: `Missing parameters: [${missingParameters.join(',')}]` })
                    }
                }

                let action = `${data.resource && data.resource.typeId}${data.action}`
                let handler = mm.manager.getHandler(action, mm.item)
                let response = await handler(data, ct)
                res.status(200).json(response)
            }
        } catch (error) {
            console.error(error.stack)
            return next({ error: error.message })
        }
    }
}

module.exports = Manager