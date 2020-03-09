const _ = require('lodash')
const CT = require('ctvault')

let payloadGenerator = {
    extensions: (hook, data) => {
        let url = `${data.protocol}://${data.host}/api${hook.path}`
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
                    headerValue: data.project
                }
            }
        }
    },

    subscriptions: service => ({
        key: service.key,
        destination: config.get('pubSub'),
        changes: mapResourceTypeIds(service.changes),
        messages: mapResourceTypeIds(service.messages)
    })
}

let mapResourceTypeIds = obj => obj && _.map(Object.keys(obj), key => ({ resourceTypeId: key }))

let serviceTypes = ['subscriptions', 'extensions']
let admin = [
    {
        key: 'admin-project',
        path: '/project',
        handler: async (data, ct) => ({
            extensions: await ct.extensions.get(),
            subscribers: await ct.subscriptions.get()
        })
    },
    {
        key: 'admin-projects',
        path: '/projects',
        handler: async (data, ct) => await CT.getClients()
    },
    {
        key: 'admin-create-credentials',
        path: '/credentials',
        method: 'post',
        handler: async (data, ct) => await CT.saveCredential(data.object)
    },
    {
        key: 'pub-sub-message',
        path: '/pubsub',
        method: 'post',
        handler: async (data, ct, router) => {
            router.processPubSub(data.object)
            return []
        }
    }
]

// sm.register({
    //     relativePath: '/pubsub',
    //     method: 'POST',
    //     handler: async (data, ct) => {
    //         processMessage(data)
    //         return data
    //     }
    // })
    
_.each(serviceTypes, type => {
    admin.push({
        key: `admin-register-${type}`,
        path: `/${type}`,
        method: 'post',
        handler: async (data, ct, router) => await ct[type].ensure(payloadGenerator[type](router.getService(data.object.key), data.object))
    })

    admin.push({
        key: `admin-delete-${type}`,
        path: `/${type}`,
        method: 'delete',
        handler: async (data, ct) => {
            console.log(data.params.key)
            let service = await ct[type].get({ key: data.params.key })
            return service ? await ct[type].delete({ id: service.id, version: service.version }) : []
        }
    })
})

module.exports = { admin }