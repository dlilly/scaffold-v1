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

    getByPath(path) {
        return { manager: this, item: _.first(_.filter(this.items, x => x.path === path)) }
    }

    manage = manager => {
        this.managers.push(manager)
    }

    handleRequest = () => {
        logger.debug(`you need to override handleRequest()`)
    }

    handle = async (req, res, next) => {
        // find the extension that handles this path
        let mappedManagers = _.map(this.managers, m => m.getByPath(req.path))
        let mm = _.first(_.filter(mappedManagers, m => m.item))
        if (!mm || !mm.manager) {
            logger.error(`Couldn't figure out where to send me: ${req.path}`)
            res.status(200).json({ actions: [] })
        }

        let projectKey = req.headers['authorization']
        let ct = await CT.getClient(projectKey)

        req.ct = ct

        if (mm.item) {
            if (mm.item.handler) {
                if (mm.item.requiredParameters) {
                    let missingParameters = _.filter(mm.item.requiredParameters, param => !req.query[param])
                    if (missingParameters.length > 0) {
                        return next({ error: `Missing parameters: [${missingParameters.join(',')}]` })
                    }
                }
                mm.item.handler(req, res, next)
            }
            else {
                mm.manager.handleRequest(mm.item)(req, res)
            }
        }
    }
}

module.exports = Manager