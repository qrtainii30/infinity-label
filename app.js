const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { networkInterfaces, type } = require('os');
const helmet = require('helmet');
const QRCode = require('qrcode');

const nets = networkInterfaces();
const results = Object.create(null);

var jsonParser = bodyParser.json();
var textParser = bodyParser.text();

app.use(express.static(path.join(__dirname, 'public')))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs');

app.use(
    helmet({
        // contentSecurityPolicy: {
        //     directives: {
        //         defaultSrc: ["*"],
        //         scriptSrc: ["* 'unsafe-inline' 'unsafe-eval'"],
        //         connectSrc: ["*"],
        //         imgSrc: ["*"],
        //         styleSrc: ["* 'unsafe-inline'"],
        //         fontSrc: ["*"],
        //         objectSrc: ["*"],
        //         mediaSrc: ["*"],
        //         frameSrc: ["*"]
        //     },
        // },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["* 'unsafe-inline'"],
                scriptSrc: ["* 'unsafe-inline' 'unsafe-eval'"],
                imgSrc: ["'self'", "data:", "'unsafe-inline'"],
                // fontSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "data:"],
                fontSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "data:", "*"],
                connectSrc: ["*"],
                frameSrc: ["'self'"],
                mediaSrc: ["*"]
            }
        }
    })
);

app.get('/', (req, res) => {
    // Get IP Address
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    // Check Directory
    if (fs.existsSync(path.join('C:', 'InfinityLabel'))) {
        // Exist
        // Do Nothing
    } else {
        // Doesn't Exist
        // Create Folder
        fs.mkdir(path.join('C:', 'InfinityLabel'), function (res) {
            // console.log(res);
        });
    }

    // Render UI
    res.render('index', {
        networkData: results
    });
});

app.post('/label_create', jsonParser, (req, res) => {
    const data = req.body;
    var appendData = JSON.stringify(data);
    var file_name = data[0].file.name;

    if (fs.existsSync(path.join('C:', 'InfinityLabel', file_name))) {
        res.status(200).json({
            type: 0,
            message: 'File Exist!'
        });
    } else {
        // Doesn't Exist
        // Create File
        fs.writeFile(path.join('C:', 'InfinityLabel', file_name), appendData, (err) => {
            if (err) {
                return res.status(500).json({
                    type: 0,
                    message: 'Failed to Create!'
                });
            }

            res.status(200).json({
                type: 1,
                message: 'New Label Created'
            });
        });
    }
});

app.get('/editor/:file', (req, res) => {
    var file_name = req.params.file;

    // Read File
    fs.readFile(path.join('C:', 'InfinityLabel', file_name), 'utf8', (err, data) => {
        if (err) {
            console.error(err);
        } else {
            try {
                var file = JSON.stringify(data);

                // Render UI
                res.render('editor', {
                    networkData: results,
                    design: file
                });
            } catch (err) {
                console.log(err);
            }
        }
    });
});

app.post('/design_update', textParser, (req, res) => {
    const component = req.body;

    var info = JSON.parse(component)[0];

    var appendData = component;
    var file_name = info.file.name;

    fs.writeFile(path.join('C:', 'InfinityLabel', file_name), appendData, (err) => {
        if (err) {
            return res.status(500).json({
                type: 0,
                message: 'Failed to Save!'
            });
        }

        res.status(200).json({
            type: 1,
            message: 'Design Updated!'
        });
    });
});

app.get('/projects', (req, res) => {
    const directoryPath = path.join('C:', 'InfinityLabel');
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).json({
                type: 0,
                message: 'Unable to scan directory!'
            });
        }

        let projects = [];
        files.forEach(file => {
            if (path.extname(file) === '.json') {
                const filePath = path.join(directoryPath, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const jsonContent = JSON.parse(content);
                    projects.push(jsonContent[0]);
                } catch (error) {
                    console.error('Error reading or parsing file:', file, error);
                }
            }
        });

        res.status(200).json(projects);
    });
});

app.post('/qrgen', textParser, async (req, res) => {
    const component = req.body;

    var info = JSON.parse(component);

    const qrCodeImage = await QRCode.toDataURL(info.text);

    res.status(200).json(qrCodeImage);
});

app.post('/savepng', textParser, async (req, res) => {
    const dataURL = req.body;
    const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');

    // Create a unique filename
    // const filename = `image-${Date.now()}.png`;

    const filePath = path.join("C:", 'InfinityLabel', 'canvas.png');

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            res.status(500).send('Error saving PNG');
        } else {
            res.send('PNG saved successfully');
        }
    });
});

app.listen(process.env.port || 3000);