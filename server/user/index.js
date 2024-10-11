const express = require('express')

const PORT = 8000

const app = express()

app.get('/', (req, res) => res.send('Hey from my own server'));


app.listen(PORT, () => console.log(`Server Started on port ${PORT}`))
