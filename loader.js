const fs = require('fs-extra')
const _ = require('lodash')
const cors = require('cors')
const bodyParser = require('body-parser')

const { errorHandler } = require('./middleware')

let loadModules = async (app) => {
    // use body-parser since we are expecting JSON input
    app.use(bodyParser.text({ type: 'text/plain' }));
    app.use(bodyParser.json())

    // CORS support
    app.use(cors());

    app.use((await require('./managers')()).router)
    app.use(errorHandler)
}

module.exports = loadModules
