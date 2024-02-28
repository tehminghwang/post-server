// __tests__/index.test.js
const request = require('supertest');
const app = require('../index'); 

jest.setTimeout(100000); 

describe('GET /api', () => {
  it('responds with a greeting message', async () => {
    const response = await request(app).get('/api');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Hello from server!' });
  });
});

jest.mock('mysql2/promise', () => ({
  createPool: () => ({
    query: jest.fn().mockResolvedValue([
      [{ postid: 1, header: 'Test Post', description: 'This is a test', number_of_likes: 5 }],
    ]),
  }),
}));

describe('GET /api/enhanced-xposts', () => {
  it('fetches posts with enhanced details', async () => {
    const response = await request(app).get('/api/enhanced-xposts');
    expect(response.statusCode).toBe(200);
    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toHaveProperty('postid', 1);
  });
});


describe('GET /api/comments', () => {
  it('requires postid query parameter', async () => {
    const response = await request(app).get('/api/comments');
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Missing required postid query parameter.');
  });

  it('fetches comments for a given postid', async () => {
    const response = await request(app).get('/api/comments?postid=1');
    expect(response.statusCode).toBe(200);

  });
});
