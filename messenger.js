const _ = require('lodash')

let listeners = {}

const addListener = (key, handler) => {
    let keyListeners = listeners[key] || []
    keyListeners.push(handler)
    listeners[key] = keyListeners
}

const broadcast = (key, value) => {
    let keyListeners = listeners[key] || []
    _.each(keyListeners, l => {
        l(value)
    })
}

module.exports = {
    addListener, broadcast
}