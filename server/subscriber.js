// third party libs
const _ = require('lodash')
const { PubSub } = require('@google-cloud/pubsub');

const CT = require('ctvault')

// sm.register({
//     relativePath: '/pubsub',
//     method: 'POST',
//     handler: async (data, ct) => {
//         processMessage(data)
//         return data
//     }
// })

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

module.exports = processMessage