require('dotenv').config()
const NewsfeedRouter = require('./routers/newsfeed')
const express = require('express')
const app = express()
const cors = require('cors')
const PostRouter = require('./routers/post')

//const mongoUrl = process.env.MONGO_URL
//mongoose.connect(mongoUrl)

// app.use(express.static('build'))
app.use(cors())
app.use(express.json());
app.use('/',NewsfeedRouter)
app.use('/',PostRouter)

const PORT = process.env.PORT || 3003

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
