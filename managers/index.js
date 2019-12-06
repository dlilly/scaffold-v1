const Manager = require('./manager')

module.exports = async() => {
    const manager = new Manager()
    await manager.load()
    return manager
}