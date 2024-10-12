const http = require('http')
const express = require('express')
const fs = require('fs/promises')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const cors = require('cors')
const chokidar = require('chokidar')
const os = require('os')
const pty = require('node-pty')

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const clientIndexPath = path.join(__dirname, '../client/src')

const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: clientIndexPath,
    env: process.env
});

const app = express()
const server = http.createServer(app);
const io = new SocketServer({
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

app.use(cors())

io.attach(server);

chokidar.watch(clientIndexPath).on('all', (event, filePath) => {
    io.emit('file:refresh', filePath)
});

ptyProcess.onData(data => {
    io.emit('terminal:data', data)
})

io.on('connection', (socket) => {
    console.log(`Socket connected`, socket.id)

    socket.emit('file:refresh')

    socket.on('file:change', async ({ filePath, content }) => {
        await fs.writeFile(clientIndexPath, filePath, content)
    })

    socket.on('terminal:write', (data) => {
        console.log('Term', data)
        ptyProcess.write(data);
    })
})

app.get('/files', async (req, res) => {
    const fileTree = await generateFileTree(clientIndexPath);
    return res.json({ tree: fileTree })
})

app.get('/files/content', async (req, res) => {
    const filePath = req.query.path;
    const content = await fs.readFile(path.join(clientIndexPath, filePath), 'utf-8')
    return res.json({ content })
})

server.listen(9000, () => console.log(`🐳 Docker server running on port 9000`))


async function generateFileTree(directory) {
    const tree = {}

    async function buildTree(currentDir, currentTree) {
        const files = await fs.readdir(currentDir)

        for (const file of files) {
            const filePath = path.join(currentDir, file)
            const stat = await fs.stat(filePath)

            if (stat.isDirectory()) {
                currentTree[file] = {}
                await buildTree(filePath, currentTree[file])
            } else {
                currentTree[file] = null
            }
        }
    }

    await buildTree(directory, tree);
    return tree
}