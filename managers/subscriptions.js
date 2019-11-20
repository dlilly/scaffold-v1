// third party libs
const _ = require('lodash')
const { PubSub } = require('@google-cloud/pubsub');

const Manager = require('./manager')
const CT = require('ctvault')

class SubscriptionManager extends Manager {
    constructor() {
        super()
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
    relativePath: 'register',
    handler: async (req, res) => {
        let client = await CT.getClient(req.query.project)
        let subscription = await client.subscriptions.get({ key: req.query.subscription })
    
        if (subscription) {
            res.status(400).json({ message: `Subscription [ ${req.query.subscription} ] already registered on project [ ${req.query.project} ]`})
        }
        else {
            let subscriptionTemplate = subscriptionManager.get(req.query.subscription)
    
            if (subscriptionTemplate) {
                let payload = {
                    key: subscriptionTemplate.key,
                    destination: config.get('pubSub'),
                    changes: mapResourceTypeIds(subscriptionTemplate.changes),
                    messages: mapResourceTypeIds(subscriptionTemplate.messages)
                }
    
                let result = (await client.subscriptions.ensure(payload)).body

                // console.log(JSON.stringify(payload))

                res.status(200).json(result)
            }
            else {
                res.status(400).json({ message: `Subscription template [ ${req.query.subscription} ] not found`})
            }
        }
    }
})

sm.register({
    relativePath: 'deregister',
    handler: async (req, res) => {
        let client = await CT.getClient(req.query.project)
        let subscription = await client.subscriptions.get({ key: req.query.subscription })
        
        if (subscription) {
            res.status(200).json(await client.subscriptions.delete(subscription))
        }
        else {
            res.status(400).json({ message: `Subscription [ ${req.query.subscription} ] not registered on project [ ${req.query.project} ]`})
        }
    }
})

sm.register({
    relativePath: 'pubsub',
    method: 'POST',
    handler: async (req, res) => {
        processMessage(req.body)
        res.status(200).json(req.body)
    }
})

module.exports = sm

// local function declarations
let processMessage = async message => {
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
        _.each(_.filter(this.subscribers, sub => _.includes(_.map(subscriptions, 'key'), sub.key)), subscriber => {
            if (resourceType === 'Message') {
                if (subscriber.messages && subscriber.messages[message.notificationType]) {
                    let method = subscriber.messages[message.notificationType]
                    method(resource, ct)
                    sent = true
                }
            }
            else {
                if (subscriber.changes && subscriber.changes[resourceType] && subscriber.changes[resourceType][message.notificationType]) {
                    let method = subscriber.changes[resourceType][message.notificationType]
                    method(resource, ct)
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
    processMessage(message)
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