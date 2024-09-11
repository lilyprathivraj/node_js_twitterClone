const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jsonwebtoken = require('jsonwebtoken')

const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const startServerAndDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('server running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`db error: ${error.message}`)
    process.exit(1)
  }
}
startServerAndDb()

//Authentication
const authentication = (request, response, next) => {
  const authToken = request.headers['authorization']
  let jwtToken = null
  if (authToken !== undefined) {
    jwtToken = authToken.split(' ')[1]
  }
  if (authToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jsonwebtoken.verify(jwtToken, 'MY_SECRET_KEY', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//API1
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const usernameCheckQuery = `
    select * from user
    where username = '${username}'
    `
  const userDetails = await db.get(usernameCheckQuery)
  if (userDetails !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const postQuery = `
            insert into user(username,password,name,gender)
            values('${username}','${hashedPassword}','${name}','${gender}')
            `
      await db.run(postQuery)
      response.send('User created successfully')
    }
  }
})

//API2
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const usernameCheckQuery = `
    select * from user
    where username = '${username}'
    `
  const userDetails = await db.get(usernameCheckQuery)
  if (userDetails === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isCorrectPassword = await bcrypt.compare(
      password,
      userDetails.password,
    )
    if (isCorrectPassword) {
      const payload = {username: username}
      const jwtToken = jsonwebtoken.sign(payload, 'MY_SECRET_KEY')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API3
app.get('/user/tweets/feed/', authentication, async (request, response) => {
  const getTweetsQuery = `
  select * from follower natural join tweet natural join user
  order by following_user_id
  limit 4 offset 7;`
  const tweetsDetails = await db.all(getTweetsQuery)
  const caseChange = each => {
    return {
      username: each.username,
      tweet: each.tweet,
      dateTime: each.date_time,
    }
  }
  response.send(tweetsDetails.map(each => caseChange(each)))
})

//API4
app.get('/user/following/', authentication, async (request, response) => {
  const getUserID = `
  select user_id from user
  where username = '${request.username}';`

  const user_id = await db.get(getUserID)
  console.log(user_id.user_id)
  const getNameQuery = `
  select * from follower inner join user on follower.follower_user_id=user.user_id
  where following_user_id = ${user_id.user_id};
  `
  const names = await db.all(getNameQuery)
  const caseChange = each => {
    return {
      name: each.name,
    }
  }
  console.log(names)
  response.send(names.map(each => caseChange(each)))
})

//API5
app.get('/user/followers/', authentication, async (request, response) => {
  const getUserID = `
  select user_id from user
  where username = '${request.username}';`

  const user_id = await db.get(getUserID)
  console.log(user_id.user_id)
  const getNameQuery = `
  select * from follower inner join user on follower.following_user_id=user.user_id
  where follower_user_id = ${user_id.user_id};
  `
  const names = await db.all(getNameQuery)
  const caseChange = each => {
    return {
      name: each.name,
    }
  }
  console.log(names)
  response.send(names.map(each => caseChange(each)))
})

//API6
app.get('/tweets/:tweetId/', authentication, async (request, response) => {
  const {tweetId} = request.params

  const getUserID = `
  select user_id from user
  where username = '${request.username}';`

  const user_id = await db.get(getUserID)
  console.log(user_id.user_id)

  const isUserFollwingQuery = `
  select * from tweet inner join follower on follower.follower_user_id=tweet.user_id
  where tweet_id = ${tweetId} and following_user_id = ${user_id.user_id}
  `
  const isUserFollwing = await db.get(isUserFollwingQuery)

  if (isUserFollwing === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const getTweetsQuery = `
    select tweet,count(distinct like_id) as likes, count(distinct reply_id) as replies, date_time as dateTime from tweet 
    inner join like on tweet.tweet_id = like.tweet_id
    inner join reply on tweet.tweet_id = reply.tweet_id
    where tweet.tweet_id = ${tweetId};
    `
    const tweets = await db.get(getTweetsQuery)
    response.send(tweets)
  }
})

//API7
app.get(
  '/tweets/:tweetId/likes/',
  authentication,
  async (request, response) => {
    const {tweetId} = request.params

    const getUserID = `
  select user_id from user
  where username = '${request.username}';`

    const user_id = await db.get(getUserID)
    console.log(user_id.user_id)

    const isUserFollwingQuery = `
  select * from tweet inner join follower on follower.follower_user_id=tweet.user_id
  where tweet_id = ${tweetId} and following_user_id = ${user_id.user_id}
  `
    const isUserFollwing = await db.get(isUserFollwingQuery)

    if (isUserFollwing === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const getLikesQuery = `
      select username as likes from like 
      inner join user on like.user_id=user.user_id
      where tweet_id = ${tweetId};
    `
      const tweets = await db.all(getLikesQuery)
      const likesList = []
      for (let likeObject of tweets) {
        likesList.push(likeObject.likes)
      }
      response.send({likes: likesList})
    }
  },
)

//API8
app.get(
  '/tweets/:tweetId/replies/',
  authentication,
  async (request, response) => {
    const {tweetId} = request.params

    const getUserID = `
    select user_id from user
    where username = '${request.username}';`

    const user_id = await db.get(getUserID)
    console.log(user_id.user_id)

    const isUserFollwingQuery = `
      select * from tweet inner join follower on follower.follower_user_id=tweet.user_id
      where tweet_id = ${tweetId} and following_user_id = ${user_id.user_id}
      `
    const isUserFollwing = await db.get(isUserFollwingQuery)

    if (isUserFollwing === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const getReplysQuery = `
      select name,reply from reply 
      inner join user on reply.user_id=user.user_id
      where tweet_id = ${tweetId};
    `
      const replys = await db.all(getReplysQuery)

      response.send({replies: replys})
    }
  },
)

//API9
app.get('/user/tweets/', authentication, async (request, response) => {
  const getTweetsQuery = `
    select tweet,count(like_id) as likes,count(reply_id) as replies,date_time as dateTime from tweet 
    left join like on tweet.tweet_id=like.tweet_id
    left join reply on tweet.tweet_id=reply.tweet_id
    group by tweet.tweet_id;
    
    `
  const tweets = await db.all(getTweetsQuery)
  response.send(tweets)
})

//API10
app.post('/user/tweets/', authentication, async (request, response) => {
  const {tweet} = request.body
  const postQuery = `
  insert into tweet(tweet)
  values('${tweet}');`
  await db.run(postQuery)
  response.send('Created a Tweet')
})

//API11
app.delete('/tweets/:tweetId/', authentication, async (request, response) => {
  const {tweetId} = request.params

  const getUserID = `
  select user_id from user
  where username = '${request.username}';`

  const user_id = await db.get(getUserID)
  console.log(user_id.user_id)

  const isOwnUserQuery = `
  select user_id from tweet 
  where tweet_id = ${tweetId}
  `
  const isOwnUser = await db.get(isOwnUserQuery)
  console.log(isOwnUser.user_id === user_id.user_id)
  if (isOwnUser.user_id === user_id.user_id) {
    const deleteQuery = `
    delete from tweet
    where tweet_id = ${tweetId};
    `
    await db.run(deleteQuery)
    response.send('Tweet Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})
module.exports = app
//tweet,count(distinct like_id) as likes, count(distinct reply_id) as replies, date_time as dateTime
