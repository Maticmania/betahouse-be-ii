import supertest from 'supertest';
import mongoose from 'mongoose';
import app from '../../index.js';
import User from '../models/User.js';
import AgentApplication from '../models/AgentApplication.js';
import { generateToken } from '../utils/auth.js';

const request = supertest(app);

describe('Agent Application API (/api/v2/agent-applications)', () => {
  let regularUser, adminUser, regularUserToken, adminUserToken;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await mongoose.connection.dropDatabase();

    // Create users
    regularUser = await User.create({
      email: 'user@example.com',
      password: 'password123',
      role: 'user',
      isEmailVerified: true,
    });

    adminUser = await User.create({
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      isEmailVerified: true,
    });

    // Generate tokens
    regularUserToken = generateToken(regularUser._id);
    adminUserToken = generateToken(adminUser._id);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await AgentApplication.deleteMany({});
  });

  describe('POST /', () => {
    it('should allow an authenticated user to create a new application', async () => {
      const res = await request
        .post('/api/v2/agent-applications')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          personal: { firstName: 'Test', lastName: 'User' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.user).toBe(regularUser._id.toString());
      const app = await AgentApplication.findById(res.body.data._id);
      expect(app).toBeTruthy();
    });

    it('should return 401 for unauthenticated requests', async () => {
      const res = await request.post('/api/v2/agent-applications').send({});
      expect(res.status).toBe(401);
    });
  });

  describe('GET /user/me', () => {
    it('should retrieve the application for the authenticated user', async () => {
      await AgentApplication.create({ user: regularUser._id, status: 'submitted' });

      const res = await request
        .get('/api/v2/agent-applications/user/me')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user._id).toBe(regularUser._id.toString());
    });

    it('should return 404 if the user has no application', async () => {
        const res = await request
          .get('/api/v2/agent-applications/user/me')
          .set('Authorization', `Bearer ${regularUserToken}`);
  
        expect(res.status).toBe(404);
      });
  });

  describe('GET /:id', () => {
    it('should allow a user to retrieve their own application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id });

        const res = await request
            .get(`/api/v2/agent-applications/${application._id}`)
            .set('Authorization', `Bearer ${regularUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data._id).toBe(application._id.toString());
    });

    it('should allow an admin to retrieve any application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id });

        const res = await request
            .get(`/api/v2/agent-applications/${application._id}`)
            .set('Authorization', `Bearer ${adminUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.user._id).toBe(regularUser._id.toString());
    });
  });

  describe('GET /', () => {
    it('should allow an admin to get all applications', async () => {
        await AgentApplication.create({ user: regularUser._id });
        await AgentApplication.create({ user: adminUser._id });

        const res = await request
            .get('/api/v2/agent-applications')
            .set('Authorization', `Bearer ${adminUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
    });

    it('should forbid a regular user from getting all applications', async () => {
        const res = await request
            .get('/api/v2/agent-applications')
            .set('Authorization', `Bearer ${regularUserToken}`);

        expect(res.status).toBe(403);
    });
  });

  describe('PUT /:id', () => {
    it('should allow a user to update their own draft application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id, status: 'draft' });

        const res = await request
            .put(`/api/v2/agent-applications/${application._id}`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send({ personal: { firstName: 'Updated Name' } });

        expect(res.status).toBe(200);
        expect(res.body.data.personal.firstName).toBe('Updated Name');
        const updatedApp = await AgentApplication.findById(application._id);
        expect(updatedApp.personal.firstName).toBe('Updated Name');
    });

    it('should forbid updating a submitted application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id, status: 'submitted' });

        const res = await request
            .put(`/api/v2/agent-applications/${application._id}`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send({ personal: { firstName: 'Updated Name' } });

        expect(res.status).toBe(403);
    });
  });

  describe('PATCH /:id/submit', () => {
    it('should allow a user to submit their draft application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id, status: 'draft' });

        const res = await request
            .patch(`/api/v2/agent-applications/${application._id}/submit`)
            .set('Authorization', `Bearer ${regularUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('submitted');
        const updatedApp = await AgentApplication.findById(application._id);
        expect(updatedApp.status).toBe('submitted');
    });
  });

  describe('PATCH /:id/status (Admin)', () => {
    it('should allow an admin to approve an application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id, status: 'submitted' });

        const res = await request
            .patch(`/api/v2/agent-applications/${application._id}/status`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .send({ status: 'approved' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('approved');
    });

    it('should allow an admin to reject an application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id, status: 'submitted' });

        const res = await request
            .patch(`/api/v2/agent-applications/${application._id}/status`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .send({ status: 'rejected', rejectionReason: 'Missing documents' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('rejected');
        expect(res.body.data.rejectionReason).toBe('Missing documents');
    });

    it('should forbid a regular user from updating status', async () => {
        const application = await AgentApplication.create({ user: regularUser._id, status: 'submitted' });

        const res = await request
            .patch(`/api/v2/agent-applications/${application._id}/status`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send({ status: 'approved' });

        expect(res.status).toBe(403);
    });
  });

  describe('DELETE /:id', () => {
    it('should allow a user to delete their own application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id });

        const res = await request
            .delete(`/api/v2/agent-applications/${application._id}`)
            .set('Authorization', `Bearer ${regularUserToken}`);

        expect(res.status).toBe(200);
        const deletedApp = await AgentApplication.findById(application._id);
        expect(deletedApp).toBeNull();
    });

    it('should allow an admin to delete any application', async () => {
        const application = await AgentApplication.create({ user: regularUser._id });

        const res = await request
            .delete(`/api/v2/agent-applications/${application._id}`)
            .set('Authorization', `Bearer ${adminUserToken}`);

        expect(res.status).toBe(200);
        const deletedApp = await AgentApplication.findById(application._id);
        expect(deletedApp).toBeNull();
    });
  });

});
