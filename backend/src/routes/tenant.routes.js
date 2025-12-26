const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/tenant.controller');

router.get('/:tenantId', auth, controller.getTenantById);
router.put('/:tenantId', auth, controller.updateTenant);
router.get('/', auth, controller.listTenants);

module.exports = router;
