const _ = require('lodash')

const Manager = require('./manager')

class MicroservicesManager extends Manager {
    constructor(opts) {
        super(opts)
        this.key = 'microservices'
    }
}

let mm = new MicroservicesManager()
module.exports = router => {
    mm.router = router
    return mm
}