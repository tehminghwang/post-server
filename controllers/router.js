const stringHash = require("string-hash");
const redis = require("redis");

(async () => {
  const client = redis.createClient();
  const uni = "Imperial University of Singapore";
  const hashedUni = stringHash(uni) % 1;

  client.on("error", (err) => console.log("Redis Client Error", err));
  await client.connect();

  client.on("connect", () => {
    console.log("Connected to Redis");
  });

  await client.set("key2", "va1lue");
  const haha = await client.get("key2");
  console.log(haha);
  client.quit();
})();
