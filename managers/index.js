const CT = require('ctvault')
const Manager = require('./manager')

const extensionManager = require('./extensions')
const subscriptionManager = require('./subscriptions')
const microserviceManager = require('./microservices')

const manager = new Manager()
manager.manage(extensionManager)
manager.manage(subscriptionManager)
manager.manage(microserviceManager)

const credentialManager = new Manager()
credentialManager.key = 'credentials'
credentialManager.register({
    relativePath: 'register',
    handler: async (req, res) => {
        let client = await CT.getClient(req.query.project)
    
        if (client) {
            if (req.query.force) {
                // if there's already a project registered with these creds what do we do?
                res.status(200).json({})    
            }
            else {
                res.status(400).json({ error: `Error creating CTP client for project [ ${req.query.project} ]: credentials already exist; use force parameter to override` })
            }
        }
        else {
            try {
                let credential = await CT.saveCredential(req.query)
                if (credential.disabled) {
                    res.status(400).json({ error: `Error creating CTP client for project [ ${req.query.project} ]: ${credential.disabledReason}` })
                }
                else {
                    res.status(200).json({ message: `CTP credentials for project [ ${req.query.project} ] successfully imported!`})
                }
            } catch (error) {
                res.status(400).json({ error: `Error creating CTP client for project [ ${req.query.project} ]: ${error}` })
            }
        }
    }
})
manager.manage(credentialManager)

module.exports = manager