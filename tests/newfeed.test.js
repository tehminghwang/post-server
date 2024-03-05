// __tests__/index.test.js
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const app = express();
const newsfeedRoute = require('../routers/newsfeed');
const {pool} = require('../controllers/pools');

app.use(express.json());
app.use(cors());
app.use('/', newsfeedRoute);

jest.setTimeout(100000);

jest.mock('../controllers/pools', () => ({
  pool: {
    query: jest.fn(),
  },
}));

/*
describe('GET /api/enhanced-xposts', () => {
  pool.query.mockResolvedValueOnce([
    [
      {
        postid: 1,
        header: 'Test Post',
        description: 'This is a test',
        number_of_likes: 5,
      },
    ],
  ]);

  it('fetches posts with enhanced details', async () => {
    const response = await request(app).get('/api/enhanced-xposts');
    expect(response.statusCode).toBe(200);
    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toHaveProperty('postid', 1);
  });
});
*/

describe('GET /api/comments', () => {
  pool.query.mockResolvedValueOnce([
    [
      {
        postid: 1,
        header: 'Test Post',
        description: 'This is a test',
        number_of_likes: 5,
      },
    ],
  ]);

  it('requires postid query parameter', async () => {
    const response = await request(app).get('/api/comments');
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe(
        'Missing required postid query parameter.',
    );
  });

  it('fetches comments for a given postid', async () => {
    const response = await request(app).get('/api/comments?postid=1');
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /api/interests', () => {
  pool.query.mockResolvedValueOnce([
    [
      {
        interests: [
          {interestid: 1, interest: 'Flatmate', url: '/house.jpeg'},
          {interestid: 2, interest: 'Group project', url: '/project.jpeg'},
          {interestid: 3, interest: 'Internship', url: '/internship.jpeg'},
          {interestid: 4, interest: 'Study group', url: '/study.jpeg'},
          {interestid: 5, interest: 'Competition', url: '/competition.jpeg'},
        ],
      },
    ],
  ]);

  it('fetches categories', async () => {
    const response = await request(app).get('/api/interests');
    expect(pool.query).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
  });
});

/*
describe('GET /api/getTotalMetrics', () => {
  pool.query.mockResolvedValueOnce([
    [{likes: {postscount: 7, likescount: 1, commentscount: 22}}],
  ]);

  it('fetches total metrics', async () => {
    const response = await request(app).get('/api/getTotalMetrics');
    expect(pool.query).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      likes: {likes: {commentscount: 22, likescount: 1, postscount: 7}},
    });
  });
});

describe('POST /api/comments', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('missing fields will failed to be posted', async () => {
    const req = {
      comment: 'abc',
      postid: 5,
    };
    const response = await request(app).post('/api/comments').send(req);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing required comment fields.');
  });

  it('successful posting', async () => {
    pool.query
        .mockResolvedValueOnce([[{insertId: 5}]])
        .mockResolvedValueOnce([[{email: 'abc@gmail.com'}]]);

    const req = {
      postid: '123',
      comment_userid: '123',
      comment: 'Abc',
    };
    const response = await request(app).post('/api/comments').send(req);

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(201);
    expect(response.body).toEqual(
        expect.objectContaining({email: 'abc@gmail.com'}),
    );
  });
});

 */
