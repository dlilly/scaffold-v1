const nconf = require('nconf')
nconf.argv().env().file('envjson', 'config/env.json').file('config/default.json')
module.exports = nconf