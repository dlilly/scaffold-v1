const _ = require('lodash')

const Manager = require('./manager')
const CT = require('ctvault')

class ExtensionManager extends Manager {
    constructor() {
        super()
        this.key = 'extensions'
    }

    getHandler = (action, extension) => {
        let trigger = _.first(_.filter(extension.triggers, trigger => trigger.action === action))
        return trigger && trigger.handler
    }

    handleRequest = extension => {
        return async (req, res) => {
            let projectKey = req.headers['authorization'] || req.headers['X-CTP-Project']
        
            try {
                let resource = req.body && req.body.resource && req.body.resource.obj
                let ct = await CT.getClient(projectKey)

                let actions = []
    
                if (extension.triggers) {
                    let updateMethod = extension.triggers[req.body.resource.typeId] && extension.triggers[req.body.resource.typeId][req.body.action]
                    if (updateMethod) {
                        actions = await updateMethod(resource, ct)
                    }
                    else {
                        logger.error(`No extension defined on project ${projectKey} for resource type [ ${req.body.resource.typeId} ] and action [ ${req.body.action} ]`)
                    }
                    
                    logger.debug(`actions ${JSON.stringify({ actions: _.flatMap(actions) }, '', 4)}`)
                    res.status(200).json({ actions: _.flatMap(actions) })
                }
            } catch (error) {
                logger.error(error)
            }
        }
    }

    getPayload = (hook, query) => {
        let url = `${query.protocol}://${query.host}/api${hook.path}`
        const triggers = _.map(Object.keys(hook.triggers), key => {
            return {
                resourceTypeId: key,
                actions: _.map(Object.keys(hook.triggers[key]), ak => `${ak}`)
            }
        })

        return {
            key: hook.key,
            triggers,
            destination: {
                type: "HTTP",
                url,
                authentication: {
                    type: "AuthorizationHeader",
                    headerValue: query.project
                }
            }
        }
    }
}

let xm = new ExtensionManager()
xm.register({
    relativePath: 'register',
    handler: async (req, res, next) => {
        let client = await CT.getClient(req.query.project)
        let hook = xm.get(req.query.extension)
        if (hook) {
            res.status(200).json(await client.extensions.ensure(xm.getPayload(hook, req.query)))
        }
        else {
            next({ error: `No extension found for key ${req.query.extension}` })
        }
    }
})

xm.register({
    relativePath: 'deregister',
    handler: async (req, res, next) => {
        let client = await CT.getClient(req.query.project)
        let extension = await client.extensions.get({ key: req.query.extension })
        if (extension) {
            res.status(200).json(await client.extensions.delete(extension))
        }
        else {
            next({ message: `Extension [ ${req.query.extension} ] not registered on project [ ${req.query.project} ]` })
        }
    }
})

module.exports = xm