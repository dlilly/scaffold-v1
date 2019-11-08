const _ = require('lodash')

const Manager = require('./manager')

class MicroservicesManager extends Manager {
    constructor() {
        super()
        this.key = 'microservices'
    }
}

let mm = new MicroservicesManager()
module.exports = mm