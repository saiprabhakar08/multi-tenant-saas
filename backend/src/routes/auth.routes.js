const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');

router.post('/register-tenant', controller.registerTenant);
router.post('/login', controller.login);

module.exports = router;
