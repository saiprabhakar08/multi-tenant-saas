const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/project.controller');

router.post('/projects', auth, controller.createProject);
router.get('/projects', auth, controller.listProjects);
router.put('/projects/:projectId', auth, controller.updateProject);
router.delete('/projects/:projectId', auth, controller.deleteProject);

module.exports = router;
