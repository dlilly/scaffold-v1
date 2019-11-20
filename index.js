// express app setup
const express = require('express')
const app = express();
global.config = require('./config')

const port = global.config.get('port') || 4001;
app.listen(port, async () => {
    await require('./loader')(app)
    logger.info('Server started on port: ' + port);
});