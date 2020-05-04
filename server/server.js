const cors = require('cors')
const bodyParser = require('body-parser')
require('./utils')

// express app setup
const express = require('express')
const app = express();

global.config = require('./config')

const port = global.config.get('port') || 4001;
app.listen(port, async () => {
    // use body-parser since we are expecting JSON input
    app.use(bodyParser.text({ type: 'text/plain' }));
    app.use(bodyParser.json())

    // CORS support
    app.use(cors());

    app.use('/ui', express.static(`${__dirname}/ui`));

    // await require('./managers')()
    app.use(require('./router'))

    // K8s liveness/readiness probe
    app.get('/isready', async (req, res) => {
        res.sendStatus(200);
    });

    // global error handler
    app.use((err, req, res, next) => {
        if (res.headersSent) {
            return next(err)
        }
        res.status(500).json(err)
    })

    logger.info('Server started on port: ' + port);
});