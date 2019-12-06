const CT = require('ctvault')
const Manager = require('./manager')

class CredentialManager extends Manager {
    constructor(opts) {
        super(opts)
        this.key = 'credentials'
    }
}

let cm = new CredentialManager({
    routes: [{
        relativePath: '',
        method: 'POST',
        isAdmin: true,
        handler: async (data, ct) => {
            let credential = await CT.hasClient(data.object.project)
            if (credential && !data.params.force) {
                throw new Error(`Error creating CTP client for project [ ${data.object.project} ]: credentials already exist; use force parameter to override`)
            }
            else {
                credential = await CT.saveCredential(data.object)
            }
            return credential
        }
    },{
        relativePath: '/:project',
        method: 'DELETE',
        isAdmin: true,
        handler: async (data, ct) => {
            let credential = await CT.hasClient(data.params.project)
            if (!credential) {
                throw new Error(`Error deleting credentials for project ${data.params.project}: not found`)
            }
            return await CT.deleteCredential({ key: data.params.project })
        }
    }]
})

module.exports = router => {
    cm.router = router
    return cm
}