import { Router } from 'express';
import { authenticate }    from '../middleware/authenticate.js';
import { requireRole }     from '../middleware/requireRole.js';
import {
  getOrganization,
  getStaff, updateStaffStatus,
  getReports,
  reassignLabOrder,
} from '../controllers/managerController.js';
import {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
} from '../controllers/organizationController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));

// Organization
router.get('/organization',              getOrganization);

// Staff
router.get('/staff',                     getStaff);
router.patch('/staff/:userId/status',    updateStaffStatus);

// Departments
router.get('/departments',                          getDepartments);
router.post('/departments',                         createDepartment);
router.patch('/departments/:departmentId',          updateDepartment);
router.delete('/departments/:departmentId',         deleteDepartment);
router.get('/departments/:departmentId/members',    getDepartmentMembers);

// Reports
router.get('/reports',                              getReports);

// Lab order management
router.patch('/lab-orders/:testId/reassign',        reassignLabOrder);

export default router;
