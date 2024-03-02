const mysql = require("mysql2/promise");
const stringHash = require("string-hash");
const redis = require("redis");

const redisResult = async (uni) => {
  const client = redis.createClient();

  client.on("error", (err) => console.log("Redis Client Error", err));

  await client.connect();

  client.on("connect", () => {
    console.log("Connected to Redis");
  });

  let poolNum = await client.get(uni);
  if (!poolNum) {
    poolNum = stringHash(uni) % 1;
    await client.set(uni, poolNum, { NX: true });
  }
  await client.quit();
  return poolNum;
};

const pools = async (uni = "National") => {
  let pool;

  // const poolNum = await redisResult(uni);
  const poolNum = "0";

  switch (poolNum) {
    case "0":
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT,
      });

      break;
  }
  return pool;
};

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT,
});

module.exports = { pool, pools };
