const router = require('express').Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');

router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/firebase', authController.firebaseLogin);
router.get('/profile', authMiddleware, authController.profile);

module.exports = router;