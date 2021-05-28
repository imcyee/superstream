import express from 'express';
import feedRoute from './feed';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/',
    route: feedRoute,
  },
  // {
  //   path: '/users',
  //   route: userRoute,
  // },
];

// const devRoutes = [
//   // routes available only in development mode
//   {
//     path: '/docs',
//     route: docsRoute,
//   },
// ];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

// /* istanbul ignore next */
// if (config.env === 'development') {
//   devRoutes.forEach((route) => {
//     router.use(route.path, route.route);
//   });
// }

// module.exports = router;
export default router