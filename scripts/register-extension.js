const CT = require('ctvault')

const run = async() => {
    const argv = require('yargs').argv

    if (!argv.extension) {
        console.log(`Usage error: please specify extension key using --extension`)
        process.exit(0)
    }

    const ctclient = CT.getClient(argv.project);
    const actions = CT.actions
    
    let extension = await ctclient.extensions.get({ key: argv.extension })
    if (extension) {
        console.error(`Extension [ ${argv.extension} ] already registered on project [ ${argv.project} ]`)
    }
}
run()