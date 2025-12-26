const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/task.controller');

router.post('/projects/:projectId/tasks', auth, controller.createTask);
router.get('/projects/:projectId/tasks', auth, controller.listProjectTasks);
router.patch('/tasks/:taskId/status', auth, controller.updateTaskStatus);
router.put('/tasks/:taskId', auth, controller.updateTask);

module.exports = router;
