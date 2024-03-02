const Router = require("express").Router();
const postFunction = require("../controllers/post");

Router.post("/api/createPosts", async (req, res) => {
  // Extract comment details from the request body
  const { userId, header, description, visibility, interestid } = req.body;
  const active = true;
  const createTimestamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const lastUpdateTimestamp = createTimestamp;
  const visibilityBoolean = true;

  if (!header || !description || interestid === null) {
    //return res.status(400).json(req.body);
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    // Insert the comment into the database
    const result = await postFunction.createPost({
      userId,
      createTimestamp,
      lastUpdateTimestamp,
      interestid,
      header,
      description,
      visibilityBoolean,
      active,
    });

    res
      .status(201)
      .json({ message: "Post added successfully", commentId: result.insertId });
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = Router;
