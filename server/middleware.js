let CT = require('ctvault')

let readCTConfiguration = async (req, res, next) => {
    let projectKey = req.headers['authorization'] || req.body.projectKey
    req.ct = projectKey && await CT.getClient(projectKey)

    req.data = { 
        params: {
            ...req.query,
            ...req.params
        },
        object: req.body.resource && req.body.resource.obj || req.body
    }

    next()
}

let checkRequiredParameters = item => async (req, res, next) => {
    if (item.requiredParameters) {
        let missingParameters = _.filter(item.requiredParameters, param => !req.query[param])
        if (missingParameters.length > 0) {
            return next({ error: `Missing parameters: [${missingParameters.join(',')}]` })
        }
    }
    next()
}

module.exports = {
    readCTConfiguration,
    checkRequiredParameters
}