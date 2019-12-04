const _ = require('lodash')

const Manager = require('./manager')

class MicroservicesManager extends Manager {
    constructor() {
        super()
        this.key = 'microservices'
    }

    getHandler = (action, extension) => {
        return extension.handler
    }
}

let mm = new MicroservicesManager()
module.exports = mm