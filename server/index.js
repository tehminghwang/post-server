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

const getDegrees = async () => {
	try {
		const [results] = await pool.query("SELECT * FROM degrees");
		return results;
	} catch (error) {
		throw error;
	}
};

app.get("/api/degrees", async (req, res) => {
	try {
		const degrees = await getDegrees();
		res.json({ degrees });
	} catch (error) {
		console.error("Error fetching degrees:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

const getDegreeLevels = async () => {
	try {
		const [results] = await pool.query("SELECT * FROM degreelevel");
		return results;
	} catch (error) {
		throw error;
	}
};

app.get("/api/degreelevels", async (req, res) => {
	try {
		const degreeLevels = await getDegreeLevels();
		res.json({ degreeLevels });
	} catch (error) {
		console.error("Error fetching degree levels:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

const getInterests = async () => {
	try {
		const [results] = await pool.query("SELECT * FROM interest");
		return results;
	} catch (error) {
		throw error;
	}
};

app.get("/api/interests", async (req, res) => {
	try {
		const interests = await getInterests();
		res.json({ interests });
	} catch (error) {
		console.error("Error fetching interests:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Get user profile information
app.get("/api/user", (req, res) => {
	// Authenticate JWT (another microservice?)
	// If authentication fails, throw error (show error page with correct http status)
	// Check cache. If has user details, return
	// Else, execute SQL queries
	// Cache
	// Return JSON of user
});

async function isValidUniversityEmail(email) {
	try {
		const emailDomain = email.split("@")[1];
		const response = await axios.get(
			`http://universities.hipolabs.com/search?domain=${emailDomain}`
		);

		const universities = response.data;

		if (universities.length === 0) {
			return false;
		}

		return universities[0].name;
	} catch (error) {
		console.error("University API call error: ", error);
		return false;
	}
}

const validateUsername = [
	body("username").custom(async (username) => {
		const [rows] = await pool.query(
			"SELECT userid FROM users WHERE userid = ?",
			[username]
		);

		if (rows.length !== 0) {
			return Promise.reject("Username has already been taken");
		}
		return true;
	}),
];

// If is valid university, add it to the JSON so that it can add it to the database later
const validateEmail = [
	body("email").isEmail().withMessage("Incorrect email format"),
	body("email").custom(async (email, { req }) => {
		const universityName = await isValidUniversityEmail(email);

		// Attach name to request for use later
		req.universityName = universityName;

		if (!universityName) {
			return Promise.reject("Email is not from a university");
		}
		return true;
	}),
	body("email").custom(async (email) => {
		const [rows] = await pool.query("SELECT email FROM users WHERE email = ?", [
			email,
		]);

		if (rows.length !== 0) {
			return Promise.reject("Email has already been registered");
		}
		return true;
	}),
];

const validatePassword = [
	body("password")
		.isLength({ min: 8 })
		.withMessage("Password must be at least 8 characters long"),
	body("rePassword").custom((value, { req }) => {
		if (value !== req.body.password) {
			throw new Error("Password confirmation does not match");
		}
		return true;
	}),
];

const validateDegree = [
	body("degree").custom(async (degree) => {
		const [rows] = await pool.query(
			"SELECT degreeid FROM degrees WHERE degreeid = ?",
			[degree]
		);
		if (rows.length !== 1) {
			return Promise.reject("Invalid degree selected");
		}
		return true;
	}),
	body("degreeLevel").custom(async (degreeLevel) => {
		const [rows] = await pool.query(
			"SELECT degreelevelid FROM degreelevel WHERE degreelevelid = ?",
			[degreeLevel]
		);

		if (rows.length !== 1) {
			return Promise.reject("Invalid degree level selected");
		}
		return true;
	}),
];

function validateYears() {
	const currentYear = new Date().getFullYear();
	const tenYearsAgo = currentYear - 10;
	const tenYearsFromNow = currentYear + 10;

	return [
		// Validate startYear
		body("startYear").custom((value) => {
			const startYear = parseInt(value, 10);
			if (
				isNaN(startYear) ||
				startYear < tenYearsAgo ||
				startYear > currentYear
			) {
				throw new Error("Invalid start year selected");
			}

			return true;
		}),

		// Validate endYear
		body("endYear").custom((value) => {
			const endYear = parseInt(value, 10);
			if (
				isNaN(endYear) ||
				endYear < currentYear ||
				endYear > tenYearsFromNow
			) {
				throw new Error("Invalid end year selected");
			}

			return true;
		}),
	];
}

const getOrAddUniversity = async (universityName) => {
	let [university] = await pool.query(
		"SELECT universityid FROM universities WHERE university = ?",
		[universityName]
	);

	if (university.length === 0) {
		const result = await pool.query(
			"INSERT INTO universities (university) VALUES (?)",
			[universityName]
		);

		return result[0].insertId;
	}

	return university[0].universityid;
};

const addUser = async (userDetails, universityID) => {
	const {
		username,
		firstName,
		lastName,
		email,
		password,
		degree,
		degreeLevel,
		international,
		startYear,
		endYear,
		interests,
	} = userDetails;

	// Convert to boolean for SQL
	const internationalInt = international ? 1 : 0;

	const result = await pool.query(
		"INSERT INTO users (userid, firstname, lastname, email, universityid, international, degreeid, degreelevelid, startyear, endyear, passwordhash) VALUES (?, ? ,? ,? ,? ,? ,? ,? ,? ,? ,?)",
		[
			username,
			firstName,
			lastName,
			email,
			universityID,
			internationalInt,
			degree,
			degreeLevel,
			startYear,
			endYear,
			password,
		]
	);
	if (interests && interests.length > 0) {
		await addUserInterests(username, interests);
	}
};

async function addUserInterests(userID, interestIDs) {
	const insertQuery = "INSERT INTO userinterest (userid, interestid) VALUES ?";

	const values = interestIDs.map((interestID) => [userID, interestID]);

	try {
		await pool.query(insertQuery, [values]);
	} catch (error) {
		throw error;
	}
}

app.post("/api/signup", async (req, res) => {
	// Step 1: Run all field validations for not being empty and trim them
	await Promise.all(
		Object.keys(req.body).map((field) =>
			body(field)
				.trim()
				.notEmpty()
				.withMessage(`${field} cannot be empty`)
				.run(req)
		)
	);

	// Step 2: Execute all validations in parallel
	const results = await Promise.allSettled([
		...validateUsername.map((validation) => validation.run(req)),
		...validateEmail.map((validation) => validation.run(req)),
		...validatePassword.map((validation) => validation.run(req)),
		...validateDegree.map((validation) => validation.run(req)),
		validateYears().map((validation) => validation.run(req)),
	]);

	// Step 3: Check for validation errors after all validations have been executed
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		console.log("ACTUALLY IN HERE");
		console.log(errors.array());
		const formattedErrors = errors.array().reduce((acc, error) => {
			acc[error.path] = error.msg; // Map each error to its parameter (field name)
			return acc;
		}, {});
		console.log(formattedErrors);
		return res.status(400).json({ errors: formattedErrors });
	}

	// If there are no errors, proceed with your route logic
	console.log(req.body);
	console.log(req.universityName);
	// If university name not in univeristies table
	// Add to universities table
	// Get back university ID
	// If it is, get back university Id

	// Store rest in users table
	try {
		const universityID = await getOrAddUniversity(req.universityName);
		await addUser(req.body, universityID);
		res.status(201).json({ message: "Signup successful!" });
	} catch (error) {
		console.error("Signup error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.listen(PORT, IP_ADDRESS, () => {
	console.log(`Server listening on ${IP_ADDRESS}:${PORT}`);
});
