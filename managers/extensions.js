const _ = require('lodash')

const Manager = require('./manager')

class ExtensionManager extends Manager {
    constructor(opts) {
        super(opts)
        this.key = 'extensions'
    }

    getPayload(hook, query) {
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

let xm = new ExtensionManager({
    routes: [{
        relativePath: '',
        method: 'POST',
        handler: async (data, ct) => {
            let hook = xm.get(data.object.extension)
            if (hook) {
                return await ct.extensions.ensure(xm.getPayload(hook, data))
            }
            else {
                throw new Error(`No extension found for key ${data.object.extension}`)
            }
        }
    }, {
        relativePath: '/:key',
        method: 'DELETE',
        handler: async (data, ct) => {
            let extension = await ct.extensions.get({ key: data.params.key })
            if (extension) {
                return await ct.extensions.delete(extension)
            }
            else {
                throw new Error(`Extension [ ${data.params.extension} ] not registered on project [ ${data.params.project} ]`)
            }
        }
    }]
})

module.exports = router => {
    xm.router = router
    return xm
}