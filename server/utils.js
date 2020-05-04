const _ = require('lodash')

Array.ensureArray = (obj) => Array.isArray(obj) ? obj : [obj]

_.nmap = (coll, iter) => _.filter(_.map(coll, iter), x => x)

module.exports = {}