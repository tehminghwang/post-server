const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const axios = require("axios");

require("dotenv").config();

const pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	port: process.env.DB_PORT,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

// FOR DEVELOPMENT PURPOSES
const IP_ADDRESS = "127.0.0.1";
const PORT = process.env.PORT || 3001;

const app = express();
const { body, validationResult } = require("express-validator");

// FOR DEVELOPMENT PURPOSES
app.use(cors());

app.use(express.json());

app.use((req, res, next) => {
	console.log(`Received request: ${req.method} ${req.url}`);
	next();
});

app.get("/api", (req, res) => {
	res.json({ message: "Hello from server!" });
});


/* This group of functions is for posts table only */
/* There is another set of functions below with join between tables */

// dynamic get posts based on specified query fields, example usage below
// this should cover all cases
// http://127.0.0.1:3001/api/related-posts?postid=1&interestid=1&userid=0001&visibility=1&active=1
// http://127.0.0.1:3001/api/related-posts?userid=0001&active=1&createTimestamp=2024-02-19T00:00:00
const getRelatedPosts = async (queryParameters) => {
    let baseQuery = "SELECT * FROM posts WHERE 1=1";
    const queryParams = [];
    
    // Dynamically add conditions based on query parameters
    if (queryParameters.postid) {
        baseQuery += " AND postid = ?";
        queryParams.push(queryParameters.postid);
    }

	if (queryParameters.userid) {
        baseQuery += " AND userid = ?";
        queryParams.push(queryParameters.userid);
    }
	
	if (queryParameters.interestid) {
        baseQuery += " AND interestid = ?";
        queryParams.push(queryParameters.interestid);
    }

    if ('visibility' in queryParameters) { // Explicitly checking for presence to allow filtering by visibility=0
        baseQuery += " AND visibility = ?";
        queryParams.push(queryParameters.visibility);
    }

    if ('active' in queryParameters) { // Explicitly checking for presence to allow filtering by active=0
        baseQuery += " AND active = ?";
        queryParams.push(queryParameters.active);
    }

	// Filtering based on timestamp
    if (queryParameters.createTimestamp) {
        baseQuery += " AND create_timestamp >= ?";
        queryParams.push(queryParameters.createTimestamp);
    }

    if (queryParameters.updateTimestamp) {
        baseQuery += " AND last_update_timestamp >= ?";
        queryParams.push(queryParameters.updateTimestamp);
    }

    try {
        const [results] = await pool.query(baseQuery, queryParams);
        return results;
    } catch (error) {
        throw error;
    }
};

app.get("/api/related-posts", async (req, res) => {
    try {
        const relatedPosts = await getRelatedPosts(req.query);
        res.json({ relatedPosts });
    } catch (error) {
        console.error("Error fetching related posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Get all the posts ...../api/posts
const getPosts = async () => {
    try {
        const [results] = await pool.query("SELECT * FROM posts");
        return results;
    } catch (error) {
        throw error;
    }
};

app.get("/api/posts", async (req, res) => {
    try {
        const posts = await getPosts();
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get limited number of posts, dynamic filter sorting desc/asce for postid, create_timestamp, last_update_timestamp 
// http://127.0.0.1:3001/api/xposts?num=3&sortField=last_update_timestamp&sortOrder=asc
const getxPosts = async (queryParameters) => {
    let baseQuery = "SELECT * FROM posts";
    const queryParams = [];

    // Determine the sorting field and order
    const validSortFields = ['postid', 'create_timestamp', 'last_update_timestamp'];
    const sortField = validSortFields.includes(queryParameters.sortField) ? queryParameters.sortField : 'postid';
    // Invert the sort order for the initial selection to get the last 'n' rows
    const sortOrder = queryParameters.sortOrder === 'asc' ? 'DESC' : 'ASC';

    // Add sorting to the query
    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;

    // Set the limit for the number of posts to retrieve
    const limit = queryParameters.num ? parseInt(queryParameters.num, 10) : 10; // Default to 10 if not specified
    queryParams.push(limit);

    baseQuery += " LIMIT ?";

    try {
        // Fetch the last 'n' posts in the inverted order
        const [results] = await pool.query(baseQuery, queryParams);

        // If the original sortOrder was 'asc', we need to reverse the results since they were fetched in 'desc' order
        if (queryParameters.sortOrder === 'asc') {
            results.reverse();
        }

        return results;
    } catch (error) {
        throw error;
    }
};

app.get("/api/xposts", async (req, res) => {
    try {
        const posts = await getxPosts(req.query);
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching xposts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


//Get the latest update posts ....../api/posts/latest?num=3
const getLatestUpdatePosts = async (numberOfPosts) => {
    try {
        const [results] = await pool.query(
            "SELECT * FROM posts WHERE active = 1 AND visibility = 1 ORDER BY last_update_timestamp DESC LIMIT ?",
            [numberOfPosts]
        );
        return results;
    } catch (error) {
        throw error;
    }
};

app.get("/api/posts/latestupdate", async (req, res) => {
    // Number of posts to fetch, passed as a query parameter
    const numberOfPosts = req.query.num ? parseInt(req.query.num, 10) : 10; // Default to 10 posts if not specified

    try {
        const posts = await getLatestUpdatePosts(numberOfPosts);
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching latest update posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


//Get the latest creation posts ....../api/posts/latestcreation?num=3
const getLatestCreationPosts = async (numberOfPosts) => {
    try {
        const [results] = await pool.query(
            "SELECT * FROM posts WHERE active = 1 AND visibility = 1 ORDER BY create_timestamp DESC LIMIT ?",
            [numberOfPosts]
        );
        return results;
    } catch (error) {
        throw error;
    }
};

app.get("/api/posts/latestcreation", async (req, res) => {
    // Number of posts to fetch, passed as a query parameter
    const numberOfPosts = req.query.num ? parseInt(req.query.num, 10) : 10; // Default to 10 posts if not specified

    try {
        const posts = await getLatestCreationPosts(numberOfPosts);
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching latest created posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/* This group of functions is for joining tables
Table Schema: 
posts (postid, userid, create_timestamp, last_update_timestamp, interestid, header, 
description, visibility, active)
interest (interestid, interest)
likes (postid, like_userid)
users (userid, firstname, lastname, universityid)
universities (universityid, university)

Output: 
postid, userid, create_timestamp, last_update_timestamp, interestid, header, 
description, visibility, active, number_of_likes (for each postid, count the number of unique like_userid), universityid,
university (using posts' userid to find users' userid to match the universityid with the universities table to find university),
interest (using posts'interestid to find interest in interest table by matching interestid),
firstname (matched using userid), lastname (matched using userid)
*/

// Get all the posts ...../api/posts
const getEnhancedPosts = async () => {
    try {
        const query = `
            SELECT 
                p.postid, 
                p.userid, 
                p.create_timestamp, 
                p.last_update_timestamp, 
                p.interestid, 
                p.header, 
                p.description, 
                p.visibility, 
                p.active, 
                COUNT(DISTINCT l.like_userid) AS number_of_likes, 
                u.universityid, 
                un.university, 
                c.interest
            FROM 
                posts p
            LEFT JOIN 
                likes l ON p.postid = l.postid
            JOIN 
                users u ON p.userid = u.userid
            JOIN 
                universities un ON u.universityid = un.universityid
            JOIN 
                interest c ON p.interestid = c.interestid
            GROUP BY 
                p.postid, u.universityid, un.university, c.interest
            ORDER BY 
                p.postid DESC;`;

        const [results] = await pool.query(query);
        return results;
    } catch (error) {
        console.error("SQL Error: ", error.message);
        throw error;
    }
};

app.get("/api/enhancedposts", async (req, res) => {
    try {
        const posts = await getEnhancedPosts();
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching enhanced posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// dynamic get posts based on specified query fields
// http://127.0.0.1:3001/api/enhanced-related-posts?userid=0001&active=1&createTimestamp=2024-02-19T02:00:00
const getEnhancedRelatedPosts = async (queryParameters) => {
    let baseQuery = `
        SELECT 
            p.postid, p.userid, p.create_timestamp, p.last_update_timestamp, p.interestid, 
            p.header, p.description, p.visibility, p.active, 
            COUNT(DISTINCT l.like_userid) AS number_of_likes, 
            u.firstname, u.lastname, u.universityid, un.university, c.interest
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

    baseQuery += " WHERE 1=1";

    // Dynamically add conditions based on query parameters
    if (queryParameters.postid) {
        baseQuery += " AND p.postid = ?";
        queryParams.push(queryParameters.postid);
    }

    if (queryParameters.userid) {
        baseQuery += " AND p.userid = ?";
        queryParams.push(queryParameters.userid);
    }

    if (queryParameters.interestid) {
        baseQuery += " AND p.interestid = ?";
        queryParams.push(queryParameters.interestid);
    }

    if ('visibility' in queryParameters) {
        baseQuery += " AND p.visibility = ?";
        queryParams.push(queryParameters.visibility);
    }

    if ('active' in queryParameters) {
        baseQuery += " AND p.active = ?";
        queryParams.push(queryParameters.active);
    }

    if (queryParameters.createTimestamp) {
        baseQuery += " AND p.create_timestamp >= ?";
        queryParams.push(queryParameters.createTimestamp);
    }

    if (queryParameters.updateTimestamp) {
        baseQuery += " AND p.last_update_timestamp >= ?";
        queryParams.push(queryParameters.updateTimestamp);
    }

    baseQuery += " GROUP BY p.postid, u.firstname, u.lastname, u.universityid, un.university, c.interest";

    try {
        const [results] = await pool.query(baseQuery, queryParams);
        return results;
    } catch (error) {
        console.error("SQL Error: ", error.message);
        throw error;
    }
};

app.get("/api/enhanced-related-posts", async (req, res) => {
    try {
        const relatedPosts = await getEnhancedRelatedPosts(req.query);
        res.json({ relatedPosts });
    } catch (error) {
        console.error("Error fetching related posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get limited number of posts, dynamic filter sorting desc/asce for postid, create_timestamp, last_update_timestamp 
const getEnhancedxPosts = async (queryParameters) => {
    const limit1 = queryParameters.num ? parseInt(queryParameters.num, 10) : 10;
    const page = queryParameters.page ? parseInt(queryParameters.page, 10) : 1;
    const offset = (page - 1) * limit1;
	let baseQuery = `
        SELECT 
            p.postid, p.userid, p.create_timestamp, p.last_update_timestamp, p.interestid, 
            p.header, p.description, p.visibility, p.active, 
            COUNT(DISTINCT l.like_userid) AS number_of_likes, 
            u.firstname, u.lastname, u.universityid, un.university, c.interest
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
		baseQuery += " AND p.postid = ?";
		queryParams.push(queryParameters.postid);
	}

	if (queryParameters.userid) {
		baseQuery += " AND p.userid = ?";
		queryParams.push(queryParameters.userid);
	}

	if (queryParameters.interestid) {
		baseQuery += " AND p.interestid = ?";
		queryParams.push(queryParameters.interestid);
	}

	if ('visibility' in queryParameters) { // Explicitly checking for presence to allow filtering by visibility=0
		baseQuery += " AND p.visibility = ?";
		queryParams.push(queryParameters.visibility);
	}

	if ('active' in queryParameters) { // Explicitly checking for presence to allow filtering by active=0
		baseQuery += " AND p.active = ?";
		queryParams.push(queryParameters.active);
	}

	if (queryParameters.createTimestamp) {
		baseQuery += " AND p.create_timestamp >= ?";
		queryParams.push(queryParameters.createTimestamp);
	}

	if (queryParameters.updateTimestamp) {
		baseQuery += " AND p.last_update_timestamp >= ?";
		queryParams.push(queryParameters.updateTimestamp);
	}

    baseQuery += " GROUP BY p.postid, u.firstname, u.lastname, u.universityid, un.university, c.interest";

    // Determine the sorting field and order
    const validSortFields = ['p.postid', 'p.create_timestamp', 'p.last_update_timestamp'];
    const sortField = validSortFields.includes(`p.${queryParameters.sortField}`) ? `p.${queryParameters.sortField}` : 'p.postid';
    // Invert the sort order for the initial selection to get the last 'n' rows
    const sortOrder = queryParameters.sortOrder === 'asc' ? 'DESC' : 'ASC';

    // Add sorting to the query
    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;

    // Set the limit for the number of posts to retrieve
    //const limit = queryParameters.num ? parseInt(queryParameters.num, 10) : 10; // Default to 10 if not specified
    //queryParams.push(limit);

	baseQuery += " LIMIT ?, ?"; 
    queryParams.push(offset, limit1);

    try {
        const [results] = await pool.query(baseQuery, queryParams);
		if (queryParameters.sortOrder === 'asc') {
            results.reverse();
        }
        return results;
    } catch (error) {
        throw error;
    }

};

app.get("/api/enhanced-xposts", async (req, res) => {
    try {
        const posts = await getEnhancedxPosts(req.query);
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching xposts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

//Get the latest update posts
const getEnhancedLatestUpdatePosts = async (numberOfPosts) => {
    try {
        const query = `
            SELECT 
                p.postid, p.userid, p.create_timestamp, p.last_update_timestamp, p.interestid, 
                p.header, p.description, p.visibility, p.active, 
                COUNT(DISTINCT l.like_userid) AS number_of_likes, 
                u.firstname, u.lastname, u.universityid, un.university, c.interest
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
            WHERE 
                p.active = 1 AND p.visibility = 1
            GROUP BY 
                p.postid, u.firstname, u.lastname, u.universityid, un.university, c.interest
            ORDER BY 
                p.last_update_timestamp DESC
            LIMIT 
                ?`;

        const [results] = await pool.query(query, [numberOfPosts]);
        return results;
    } catch (error) {
        console.error("SQL Error: ", error.message);
        throw error;
    }
};

app.get("/api/posts/enhancedlatestupdate", async (req, res) => {
    // Number of posts to fetch, passed as a query parameter
    const numberOfPosts = req.query.num ? parseInt(req.query.num, 10) : 10; // Default to 10 posts if not specified

    try {
        const posts = await getEnhancedLatestUpdatePosts(numberOfPosts);
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching latest update posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

//Get the latest creation posts
const getEnhancedLatestCreationPosts = async (numberOfPosts) => {
    try {
        const query = `
            SELECT 
                p.postid, p.userid, p.create_timestamp, p.last_update_timestamp, p.interestid, 
                p.header, p.description, p.visibility, p.active, 
                COUNT(DISTINCT l.like_userid) AS number_of_likes, 
                u.firstname, u.lastname, u.universityid, un.university, c.interest
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
            WHERE 
                p.active = 1 AND p.visibility = 1
            GROUP BY 
                p.postid, u.firstname, u.lastname, u.universityid, un.university, c.interest
            ORDER BY 
                p.create_timestamp DESC
            LIMIT 
                ?`;

        const [results] = await pool.query(query, [numberOfPosts]);
        return results;
    } catch (error) {
        console.error("SQL Error: ", error.message);
        throw error;
    }
};

app.get("/api/posts/enhancedlatestcreation", async (req, res) => {
    // Number of posts to fetch, passed as a query parameter
    const numberOfPosts = req.query.num ? parseInt(req.query.num, 10) : 10; // Default to 10 posts if not specified

    try {
        const posts = await getEnhancedLatestCreationPosts(numberOfPosts);
        res.json({ posts });
    } catch (error) {
        console.error("Error fetching latest created posts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/* This group of functions deal with comments
Table Schema: 
comments (commentid, postid, comment_userid, comment_timestamp)
*/
const getComments = async (postid) => {
    try {
        const query = "SELECT * FROM comments WHERE postid = ?";
        const [results] = await pool.query(query, [postid]);
        return results;
    } catch (error) {
        throw error;
    }
};

app.get("/api/comments", async (req, res) => {
    // Get the postid from query parameters
    const { postid } = req.query;

    if (!postid) {
        return res.status(400).json({ error: "Missing required postid query parameter." });
    }

    try {
        const comments = await getComments(postid);
        res.json({ comments });
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



// POST comments 
app.post("/api/comments", async (req, res) => {
    // Extract comment details from the request body
    const { postid, comment_userid, comment } = req.body;

    if (!postid || !comment_userid || !comment) {
        return res.status(400).json({ error: "Missing required comment fields." });
    }

    try {
        // Use current timestamp for comment_timestamp
        const comment_timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Insert the comment into the database
        const [result] = await pool.query(
            "INSERT INTO comments (postid, comment_userid, comment_timestamp, comment) VALUES (?, ?, ?, ?)",
            [postid, comment_userid, comment_timestamp, comment]
        );

        // Send success response
        res.status(201).json({ message: "Comment added successfully", commentId: result.insertId });
    } catch (error) {
        console.error("Error posting comment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, IP_ADDRESS, () => {
	console.log(`Server listening on ${IP_ADDRESS}:${PORT}`);
});
