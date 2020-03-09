// third party libs
const _ = require('lodash')
const { PubSub } = require('@google-cloud/pubsub');

const Manager = require('./manager')
const CT = require('ctvault')

class SubscriptionManager extends Manager {
    constructor(opts) {
        super(opts)
        this.key = 'subscriptions'
    }
}

let sm = new SubscriptionManager()

let mapResourceTypeIds = obj => {
    return obj && _.map(Object.keys(obj), key => {
        return {
            resourceTypeId: key
        }
    })
}

sm.register({
    relativePath: '',
    method: 'POST',
    handler: async (data, ct) => {
        let subscription = await ct.subscriptions.get({ key: data.object.subscription })
        if (subscription) {
            throw new Error(`Subscription [ ${data.object.subscription} ] already registered on project [ ${data.object.project} ]`)
        }
        else {
            let subscriptionTemplate = sm.get(data.object.subscription)
    
            if (subscriptionTemplate) {
                let payload = {
                    key: subscriptionTemplate.key,
                    destination: config.get('pubSub'),
                    changes: mapResourceTypeIds(subscriptionTemplate.changes),
                    messages: mapResourceTypeIds(subscriptionTemplate.messages)
                }
    
                let result = (await ct.subscriptions.ensure(payload)).body
                return result
            }
            else {
                throw new Error(`Subscription template [ ${data.object.subscription} ] not found`)
            }
        }
    }
})

sm.register({
    relativePath: '/:key',
    method: 'DELETE',
    handler: async (data, ct) => {
        let subscription = _.first(await ct.subscriptions.get({ key: data.params.subscription }))
        if (subscription) {
            return await ct.subscriptions.delete(subscription)
        }
        else {
            throw new Error(`Subscription [ ${data.params.subscription} ] not registered on project [ ${data.params.project} ]`)
        }
    }
})

sm.register({
    relativePath: '/pubsub',
    method: 'POST',
    handler: async (data, ct) => {
        processMessage(data)
        return data
    }
})

module.exports = router => {
    sm.router = router
    sm.processMessage = processMessage
    return sm
}

// local function declarations
let processMessage = async message => {
    console.log(`MESSAGE: ${JSON.stringify(message, '', 4)}`)

    try {
        let projectKey = message.projectKey
        let ct = await CT.getClient(projectKey)

        let resourceType = message.resource.typeId
        let matching = ct.findMatchingMethod(resourceType)

        let resource = {}
        if (matching) {
            resource = await ct[matching].get({ id: message.resource.id })
        }
        else {
            logger.error(`Couldn't find SDK method to retrieve resource type [ ${resourceType} ]`)
        }

        let sent = false
        let subscriptions = await ct.subscriptions.get()

        _.each(_.filter(sm.items, sub => _.includes(_.map(subscriptions, 'key'), sub.key)), subscriber => {
            if (resourceType === 'Message') {
                if (subscriber.messages && subscriber.messages[message.notificationType]) {
                    let method = subscriber.messages[message.notificationType]
                    method({ object: resource }, ct)
                    sent = true
                }
            }
            else {
                if (subscriber.changes && subscriber.changes[resourceType] && subscriber.changes[resourceType][message.notificationType]) {
                    let method = subscriber.changes[resourceType][message.notificationType]
                    method({ object: resource, resourceType, notificationType: message.notificationType }, ct)
                    sent = true
                }
            }
        })

        if (!sent) {
            console.error(`No subscriber found with project key [ ${projectKey} ] for notification type [ ${resourceType} / ${message.notificationType} ]`)
        }
    } catch (error) {
        console.error(`Error processing message: `)    
        console.error(error.stack)
    }
}

let process = async pubSubMessage => {
    logger.debug(`Processing PubSub message...`)
    let message = JSON.parse(pubSubMessage.data)
    pubSubMessage.ack()
    sm.processMessage(message)
}

let topic = config.get('pubSub:topic')
if (!_.isEmpty(topic)) {
    const subscription = new PubSub().subscription(topic);
    subscription.on(`message`, process);    
    subscription.on(`error`, (error) => { logger.error(`Error connecting to Google PubSub: ${JSON.stringify(error)}`) })
    logger.info(`Connected to Google PubSub topic [ ${topic} ]`)
}
else {
    logger.error(`PubSub topic not found`)
}