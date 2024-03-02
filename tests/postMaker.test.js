const {createPost} = require('../controllers/post');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const app = express();
const postRoutes = require('../routers/post');
const {pool} = require('../controllers/pools');

app.use(express.json());
app.use(cors());
app.use('/', postRoutes);

console.error = jest.fn(); // Mock console.error

jest.mock('../controllers/pools', () => ({
  pool: {
    query: jest.fn(),
  },
}));
// jest.mock('../controllers/post', () => ({
//     createPost: jest.fn(),
//   }));

describe('createPost', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 if required fields are missing', async () => {
    const req = {
      userId: '',
      header: '',
      description: '',
      visibility: 'University',
      interestid: 1,
    };
    const res = await request(app).post('/api/createPosts').send(req);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('All fields are required.');
  });

  test('should return 500 if database query fails', async () => {
    const req = {
      body: {
        userId: 1,
        header: 'Header',
        description: 'Description',
        visibility: 'Visibility',
        interestid: 1,
      },
    };
    const res = {status: jest.fn().mockReturnThis(), json: jest.fn()};

    pool.query.mockImplementationOnce((query, values, callback) => {
      callback('Database error', null);
    });

    await createPost(req, res);

    expect(pool.query).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error.',
    });
  });

  test('should return 201 if post is created successfully', async () => {
    const req = {
      userId: 'test',
      header: 'Header',
      description: 'Description',
      visibility: 'University',
      interestid: 1,
    };
    const res = await request(app).post('/api/createPosts').send(req);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Post created successfully.');
  });
});
