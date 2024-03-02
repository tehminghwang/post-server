const {pool} = require('../../post-server/controllers/pools');

const createPost = async (queryParameters) => {
  try {
    const {
      userId,
      createTimestamp,
      lastUpdateTimestamp,
      interestid,
      header,
      description,
      visibilityBoolean,
      active,
    } = queryParameters;
    const [result] = await pool.query(
        `
            INSERT INTO posts (userid, create_timestamp, 
            last_update_timestamp, interestid, header, 
            description, visibility, active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          createTimestamp,
          lastUpdateTimestamp,
          interestid,
          header,
          description,
          visibilityBoolean,
          active,
        ],
    );
    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {createPost};
