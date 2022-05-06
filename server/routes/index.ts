import express from 'express';
import feedRoute from './feed';

const router = express.Router();

const defaultRoutes = [{
  path: '/',
  route: feedRoute,
}];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router