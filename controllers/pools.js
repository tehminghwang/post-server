const mysql = require('mysql2/promise');
const stringHash = require('string-hash');
const redis = require('redis');

// eslint-disable-next-line no-unused-vars
const redisResult = async (uni) => {
  const client = redis.createClient();

  client.on('error', (err) => console.log('Redis Client Error', err));

  await client.connect();

  client.on('connect', () => {
    console.log('Connected to Redis');
  });

  let poolNum = await client.get(uni);
  if (!poolNum) {
    poolNum = stringHash(uni) % 1;
    await client.set(uni, poolNum, {NX: true});
  }
  await client.quit();
  return poolNum;
};

const pools = async (uni = 'National') => {
  let pool;

  // const poolNum = await redisResult(uni);
  const poolNum = '0';

  switch (poolNum) {
    case '0':
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

const client = redis.createClient({
  url: process.env.REDIS_URL,
});
client.on('error', (error) => {
  console.error(`Redis error: ${error}`);
});
await client.connect();

module.exports = {pool, pools, client};
