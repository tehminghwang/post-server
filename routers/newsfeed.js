/* eslint-disable new-cap */
/* eslint-disable camelcase */
const {pool} = require('../controllers/pools');
const Router = require('express').Router();
const redis = require('redis');

const getLikes = async (queryParameters) => {
  try {
    const [likes] = await pool.query(
        'SELECT postid FROM likes WHERE like_userid = ?',
        [queryParameters.username],
    );
    return likes;
  } catch (error) {
    throw error;
  }
};

const getInterests = async () => {
  try {
    const [results] = await pool.query('SELECT * FROM interest');
    return results;
  } catch (error) {
    throw error;
  }
};

const getTotalMetrics = async (queryParameters) => {
  try {
    const [likes] = await pool.query(
        `WITH POSTS AS (
                SELECT postid
                FROM posts
                WHERE userid = ?
            ),
            TOTAL_POSTS AS (
                SELECT COUNT(postid) AS totalpost FROM POSTS
            ),
            LIKES AS (
                SELECT COUNT(postid) AS likescount
                FROM likes
                WHERE postid IN (SELECT postid FROM POSTS)
            ),
            COMMENTS AS (
                SELECT COUNT(commentid) AS commentscount
                FROM comments
                WHERE postid IN (SELECT postid FROM POSTS)
            )
            SELECT 
                COALESCE(P.totalpost) AS postscount,
                COALESCE(L.likescount, 0) AS likescount,
                COALESCE(C.commentscount, 0) AS commentscount
            FROM TOTAL_POSTS P
            LEFT JOIN LIKES L ON 1=1
            LEFT JOIN COMMENTS C ON 1=1;`,
        [queryParameters.username],
    );
    console.log(likes);
    return likes;
  } catch (error) {
    throw error;
  }
};

// eslint-disable-next-line require-jsdoc
async function searchDatabaseByPostId(postid) {
  const query = `
        SELECT 
            p.postid, p.userid, p.create_timestamp, 
            p.last_update_timestamp, p.interestid, 
            p.header, p.description, p.visibility, p.active, 
            COUNT(DISTINCT l.like_userid) AS number_of_likes, 
            u.firstname, u.lastname, u.email, 
            u.universityid, un.university, c.interest
        FROM 
            posts p
        LEFT JOIN 
            likes l ON p.postid = l.postid
        INNER JOIN 
            users u ON p.userid = u.userid
        INNER JOIN 
            universities un ON u.universityid = un.universityid
        INNER JOIN 
            interest c ON p.interestid = c.interestid
        WHERE l.postid = ?
    `;
  const params = [postid];
  return await pool.query(query, params);
}

const addLikes = async (queryParameters) => {
  // Connect to the Redis server
  const client = redis.createClient({
    url: process.env.REDIS_URL,
  });
  client.on('error', (error) => {
    console.error(`Redis error: ${error}`);
  });
  client.connect();
  try {
    const latestPostId = await client.get('latestPostId');
    const {postid, like_userid, like_timestamp, add_operation} =
      queryParameters;
    let query;
    let params;
    if (add_operation) {
      // eslint-disable-next-line max-len
      query = `INSERT INTO likes (postid, like_userid, like_timestamp) VALUES (?,?,?)`;
      params = [postid, like_userid, like_timestamp];
    } else {
      query = 'DELETE FROM likes WHERE postid = ? AND like_userid = ?';
      params = [postid, like_userid];
    }
    const [likes] = await pool.query(query, params);
    if (postid > parseInt(latestPostId) - 10) {
      const postToUpdate = await searchDatabaseByPostId(postid);
      await client.set(postid.toString(), JSON.stringify(postToUpdate));
    }
    client.quit();
    return likes;
  } catch (error) {
    throw error;
  }
};

const postComments = async (queryParameters) => {
  try {
    const {postid, comment_userid, comment} = queryParameters;
    const comment_timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
    const [result] = await pool.query(
        `INSERT INTO comments (postid, comment_userid, 
          comment_timestamp, comment) VALUES (?, ?, ?, ?)`,
        [postid, comment_userid, comment_timestamp, comment],
    );
    return result;
  } catch (error) {
    throw error;
  }
};

const getEnhancedxPosts = async (queryParameters) => {
  // Connect to the Redis server
  const client = redis.createClient({
    url: process.env.REDIS_URL,
  });
  client.on('error', (error) => {
    console.error(`Redis error: ${error}`);
  });
  const limit1 = queryParameters.num ? parseInt(queryParameters.num, 10) : 10;
  const page = queryParameters.page ? parseInt(queryParameters.page, 10) : 1;
  const offset = (page - 1) * limit1;
  let baseQuery = `
        SELECT 
            p.postid, p.userid, p.create_timestamp, 
            p.last_update_timestamp, p.interestid, 
            p.header, p.description, p.visibility, p.active, 
            COUNT(DISTINCT l.like_userid) AS number_of_likes, 
            u.firstname, u.lastname, u.email, 
            u.universityid, un.university, c.interest
        FROM 
            posts p
        LEFT JOIN 
            likes l ON p.postid = l.postid
        INNER JOIN 
            users u ON p.userid = u.userid
        INNER JOIN 
            universities un ON u.universityid = un.universityid
        INNER JOIN 
            interest c ON p.interestid = c.interestid
    `;
  const queryParams = [];

  // Existing code for dynamic filtering
  if (queryParameters.postid) {
    baseQuery += ' AND p.postid = ?';
    queryParams.push(queryParameters.postid);
  }

  if (queryParameters.userid) {
    baseQuery += ' AND p.userid = ?';
    queryParams.push(queryParameters.userid);
  }

  if (queryParameters.interestid) {
    baseQuery += ' AND p.interestid = ?';
    queryParams.push(queryParameters.interestid);
  }

  if ('visibility' in queryParameters) {
    // Explicitly checking for presence to allow filtering by visibility=0
    baseQuery += ' AND p.visibility = ?';
    queryParams.push(queryParameters.visibility);
  }

  if ('active' in queryParameters) {
    // Explicitly checking for presence to allow filtering by active=0
    baseQuery += ' AND p.active = ?';
    queryParams.push(queryParameters.active);
  }

  if (queryParameters.createTimestamp) {
    baseQuery += ' AND p.create_timestamp >= ?';
    queryParams.push(queryParameters.createTimestamp);
  }

  if (queryParameters.updateTimestamp) {
    baseQuery += ' AND p.last_update_timestamp >= ?';
    queryParams.push(queryParameters.updateTimestamp);
  }

  baseQuery +=
    ` GROUP BY p.postid, u.firstname, u.lastname, 
    u.universityid, un.university, c.interest`;

  // Determine the sorting field and order
  const validSortFields = [
    'p.postid',
    'p.create_timestamp',
    'p.last_update_timestamp',
  ];
  const sortField = validSortFields.includes(`p.${queryParameters.sortField}`) ?
    `p.${queryParameters.sortField}` :
    'p.postid';
  // Invert the sort order for the initial selection to get the last 'n' rows
  const sortOrder = queryParameters.sortOrder === 'asc' ? 'DESC' : 'ASC';

  // Add sorting to the query
  baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;


  baseQuery += ' LIMIT ?, ?';
  queryParams.push(offset, limit1);

  try {
    const [results] = await pool.query(baseQuery, queryParams);
    if (queryParameters.sortOrder === 'asc') {
      results.reverse();
    }
    if (limit1 === 1 && page === 1) {
      await client.connect();
      await client.set('latestPostId', results[0].postid.toString());
      // eslint-disable-next-line max-len
      await client.set(results[0].postid.toString(), JSON.stringify(results[0]));
      // Clear old posts from cache (maintains only 10 most recent)
      const oldPostId = results[0].postid - 10;
      const oldPost = await client.get(oldPostId.toString());
      if (oldPost) {
        await client.del(oldPostId.toString());
      }
      await client.quit();
    }
    return results;
  } catch (error) {
    throw error;
  }
};

const getComments = async (postid) => {
  try {
    const query =
      `SELECT a.*,b.email FROM comments a LEFT JOIN users b 
      ON a.comment_userid = b.userid WHERE postid = ? `;
    const [results] = await pool.query(query, [postid]);
    return results;
  } catch (error) {
    throw error;
  }
};

const getEmail = async (username) => {
  try {
    const query = 'SELECT email FROM users WHERE userid = ? ';
    const [results] = await pool.query(query, [username]);
    return results;
  } catch (error) {
    throw error;
  }
};

Router.get('/api/getlikes', async (req, res) => {
  try {
    // Insert the comment into the database
    const likes = await getLikes(req.query);
    res.json({likes});
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

Router.post('/api/addLikes', async (req, res) => {
  try {
    const likes = await addLikes(req.body);
    res.json({likes});
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

Router.get('/api/enhanced-xposts', async (req, res) => {
  try {
    const posts = await getEnhancedxPosts(req.query);
    res.json({posts});
  } catch (error) {
    console.error('Error fetching xposts:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

Router.get('/api/comments', async (req, res) => {
  // Get the postid from query parameters
  const {postid} = req.query;

  if (!postid) {
    return res
        .status(400)
        .json({error: 'Missing required postid query parameter.'});
  }

  try {
    const comments = await getComments(postid);
    res.json({comments});
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

Router.post('/api/comments', async (req, res) => {
  // Extract comment details from the request body
  const {postid, comment_userid, comment} = req.body;

  if (!postid || !comment_userid || !comment) {
    return res.status(400).json({error: 'Missing required comment fields.'});
  }
  try {
    // Insert the comment into the database
    const result = await postComments(req.body);
    const result1 = await getEmail(req.body.comment_userid);
    res
        .status(201)
        .json({email: result1[0].email, commentId: result.insertId});
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

Router.get('/api/getTotalMetrics', async (req, res) => {
  try {
    // Insert the comment into the database
    const [likes] = await getTotalMetrics(req.query);
    console.log(likes);
    res.json({likes});
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

Router.get('/api/interests', async (req, res) => {
  try {
    const interests = await getInterests();
    res.json({interests});
  } catch (error) {
    console.error('Error fetching interests:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});

module.exports = Router;
