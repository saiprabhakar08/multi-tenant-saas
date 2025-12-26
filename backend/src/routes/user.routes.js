const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/user.controller');

router.post('/tenants/:tenantId/users', auth, controller.addUser);
router.get('/tenants/:tenantId/users', auth, controller.listUsers);
router.put('/users/:userId', auth, controller.updateUser);
router.delete('/users/:userId', auth, controller.deleteUser);

module.exports = router;
